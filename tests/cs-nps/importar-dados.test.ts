import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  LinhaSalvarImportacao,
  TipoImportacao,
} from "@/lib/cs-nps/importacao-tipos";

const prismaMock = vi.hoisted(() => ({
  clienteServico: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  ErroImportacao,
  gerarModeloImportacao,
  previsualizarImportacao,
  salvarImportacao,
} from "@/lib/cs-nps/importar-dados";

const CABECALHOS = {
  Socios: [
    "cnpj",
    "razaoSocial",
    "nome",
    "telefone",
    "observacao",
    "dataNascimento",
    "vinculo",
  ],
  CS: ["cnpj", "razaoSocial", "colaborador", "sentimento", "observacao", "dataRegistro"],
  Feedbacks: [
    "cnpj",
    "razaoSocial",
    "colaborador",
    "sentimento",
    "observacao",
    "dataRegistro",
  ],
} as const;

type NomeAba = keyof typeof CABECALHOS;

interface AbaTeste {
  nome: NomeAba | string;
  cabecalhos?: readonly string[];
  linhas?: ExcelJS.CellValue[][];
}

// Fase 3.6 do Cliente Master (2026-08-14): `clienteA` representa a linha crua de
// `db.clienteServico.findMany` (id = ClienteServico.id, cliente = Cliente master aninhado).
const clienteA = {
  id: 10,
  clienteId: 501,
  servico: "Contábil",
  status: "ATIVO",
  cliente: { cnpj: "12.345.678/0001-90", razaoSocial: "Empresa Árvore Ltda" },
};

function paraArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

async function criarPlanilha(abas: AbaTeste[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  for (const aba of abas) {
    const worksheet = workbook.addWorksheet(aba.nome);
    const cabecalhos = aba.cabecalhos ?? CABECALHOS[aba.nome as NomeAba] ?? [];
    worksheet.addRow([...cabecalhos]);
    for (const linha of aba.linhas ?? []) worksheet.addRow(linha);
  }
  return paraArrayBuffer(Buffer.from(await workbook.xlsx.writeBuffer()));
}

function criarTx() {
  return {
    usuarios: { findUnique: vi.fn() },
    clienteServico: { findMany: vi.fn() },
    pessoa: { upsert: vi.fn() },
    pessoaClienteVinculo: { upsert: vi.fn() },
    clienteServicoLogCs: { createMany: vi.fn() },
    clienteServicoLogFeedback: { createMany: vi.fn() },
    auditoria: { create: vi.fn() },
  };
}

const linhaSocio: LinhaSalvarImportacao = {
  id: "socios:2",
  tipo: "socios",
  aba: "Socios",
  numeroLinha: 2,
  identificador: { cnpj: clienteA.cliente.cnpj, razaoSocial: null },
  dados: {
    nome: "Maria da Silva",
    telefone: "0011999999999",
    observacao: "Sócia fundadora",
    dataNascimento: "29/02/1984",
    vinculo: "Administradora",
  },
  clienteId: clienteA.id,
};

const linhaCs: LinhaSalvarImportacao = {
  id: "cs:2",
  tipo: "cs",
  aba: "CS",
  numeroLinha: 2,
  identificador: { cnpj: null, razaoSocial: clienteA.cliente.razaoSocial },
  dados: {
    colaborador: "Ana",
    sentimento: "pos",
    observacao: "Contato concluído com sucesso",
    dataRegistro: "2026-07-15",
  },
  clienteId: clienteA.id,
};

const linhaFeedback: LinhaSalvarImportacao = {
  id: "feedbacks:2",
  tipo: "feedbacks",
  aba: "Feedbacks",
  numeroLinha: 2,
  identificador: { cnpj: clienteA.cliente.cnpj, razaoSocial: clienteA.cliente.razaoSocial },
  dados: {
    colaborador: "Carlos",
    sentimento: "neg",
    observacao: "Cliente pediu um novo retorno",
    dataRegistro: null,
  },
  clienteId: clienteA.id,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.clienteServico.findMany.mockResolvedValue([clienteA]);
});

describe("modelo de importação", () => {
  it("gera somente as abas escolhidas e preserva CNPJ/telefone como texto", async () => {
    const buffer = await gerarModeloImportacao(["socios", "feedbacks"]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(paraArrayBuffer(buffer));

    expect(workbook.worksheets.map((aba) => aba.name)).toEqual([
      "Instrucoes",
      "Socios",
      "Feedbacks",
    ]);
    expect(workbook.getWorksheet("CS")).toBeUndefined();
    expect(workbook.getWorksheet("Socios")?.getCell("A2001").numFmt).toBe("@");
    expect(workbook.getWorksheet("Socios")?.getCell("D2001").numFmt).toBe("@");
    expect(workbook.getWorksheet("Instrucoes")?.getCell("B3").text).toContain("uma linha por sócio");
  });
});

describe("pré-visualização", () => {
  it("mantém vários sócios da mesma empresa como linhas independentes", async () => {
    const arquivo = await criarPlanilha([{
      nome: "Socios",
      linhas: [
        [clienteA.cliente.cnpj, null, "Maria", "0011999999999", null, "29/02/1984", "Sócia"],
        [clienteA.cliente.cnpj, null, "João", "0011888888888", null, "01/01/1980", "Sócio"],
      ],
    }]);

    const preview = await previsualizarImportacao(arquivo, "socios.xlsx", ["socios"]);

    expect(preview.totais).toMatchObject({ total: 2, validas: 2, ambiguas: 0, invalidas: 0 });
    expect(preview.linhas.map((linha) => linha.dados)).toEqual([
      expect.objectContaining({ nome: "Maria", telefone: "0011999999999" }),
      expect.objectContaining({ nome: "João", telefone: "0011888888888" }),
    ]);
  });

  it("resolve CNPJ único, marca CNPJ duplicado como ambíguo e encontra por razão social", async () => {
    prismaMock.clienteServico.findMany.mockResolvedValue([
      clienteA,
      { ...clienteA, id: 11, servico: "Fiscal" },
      {
        id: 20,
        clienteId: 502,
        servico: "RH",
        status: "ATIVO",
        cliente: { cnpj: "98.765.432/0001-10", razaoSocial: "Razão Exclusiva SA" },
      },
    ]);
    const arquivo = await criarPlanilha([{
      nome: "Socios",
      linhas: [
        [clienteA.cliente.cnpj, null, "Ambíguo", "0011999999999", null, null, null],
        ["98.765.432/0001-10", null, "Único", "0011999999998", null, null, null],
        [null, "  RAZAO exclusiva sa ", "Por razão", "0011999999997", null, null, null],
      ],
    }]);

    const preview = await previsualizarImportacao(arquivo, "match.xlsx", ["socios"]);

    expect(preview.linhas[0]).toMatchObject({ status: "ambigua", clienteIdSugerido: null });
    expect(preview.linhas[0].candidatos).toHaveLength(2);
    expect(preview.linhas[1]).toMatchObject({ status: "valida", clienteIdSugerido: 20 });
    expect(preview.linhas[2]).toMatchObject({ status: "valida", clienteIdSugerido: 20 });
  });

  it("rejeita CNPJ e razão social que apontam para cadastros diferentes", async () => {
    prismaMock.clienteServico.findMany.mockResolvedValue([
      clienteA,
      {
        id: 20,
        clienteId: 502,
        servico: null,
        status: "ATIVO",
        cliente: { cnpj: "98.765.432/0001-10", razaoSocial: "Outra Empresa SA" },
      },
    ]);
    const arquivo = await criarPlanilha([{
      nome: "Socios",
      linhas: [[clienteA.cliente.cnpj, "Outra Empresa SA", "Conflito", "0011999999999", null, null, null]],
    }]);

    const preview = await previsualizarImportacao(arquivo, "conflito.xlsx", ["socios"]);

    expect(preview.linhas[0].status).toBe("invalida");
    expect(preview.linhas[0].mensagens).toContain(
      "CNPJ e razão social não apontam para o mesmo cadastro",
    );
  });

  it("normaliza datas válidas e marca datas civis impossíveis", async () => {
    const arquivo = await criarPlanilha([
      {
        nome: "Socios",
        linhas: [
          [clienteA.cliente.cnpj, null, "Data válida", "0011999999999", null, "29/02/2024", null],
          [clienteA.cliente.cnpj, null, "Data inválida", "0011999999999", null, "31/02/2024", null],
        ],
      },
      {
        nome: "CS",
        linhas: [[clienteA.cliente.cnpj, null, "Ana", "pos", "Contato realizado com sucesso", "2026-07-15"]],
      },
    ]);

    const preview = await previsualizarImportacao(arquivo, "datas.xlsx", ["socios", "cs"]);

    expect(preview.linhas[0].dados).toMatchObject({ dataNascimento: "29/02/2024" });
    expect(preview.linhas[1]).toMatchObject({ status: "invalida" });
    expect(preview.linhas[1].mensagens).toContain(
      "Data inválida; use DD/MM/AAAA ou AAAA-MM-DD",
    );
    expect(preview.linhas[2].dados).toMatchObject({ dataRegistro: "2026-07-15" });
  });

  it.each([
    ["fórmula", "FORMULA_NOT_ALLOWED", async () => {
      const arquivo = await criarPlanilha([{
        nome: "Socios",
        linhas: [[clienteA.cliente.cnpj, null, { formula: '"Maria"', result: "Maria" }, null, null, null, null]],
      }]);
      return arquivo;
    }],
    ["coluna extra", "UNEXPECTED_COLUMN", async () => criarPlanilha([{
      nome: "Socios",
      linhas: [[clienteA.cliente.cnpj, null, "Maria", null, null, null, null, "inesperado"]],
    }])],
    ["aba extra", "UNEXPECTED_SHEET", async () => criarPlanilha([
      { nome: "Socios", linhas: [[clienteA.cliente.cnpj, null, "Maria", null, null, null, null]] },
      { nome: "Oculta", cabecalhos: ["x"], linhas: [["y"]] },
    ])],
    ["cabeçalho alterado", "INVALID_HEADER", async () => criarPlanilha([{
      nome: "Socios",
      cabecalhos: ["cnpj", "razaoSocial", "apelido"],
      linhas: [[clienteA.cliente.cnpj, null, "Maria"]],
    }])],
  ])("bloqueia %s", async (_cenario, codigo, montar) => {
    const arquivo = await montar();

    await expect(previsualizarImportacao(arquivo, "invalida.xlsx", ["socios"]))
      .rejects.toMatchObject({ code: codigo });
  });
});

describe("confirmação transacional", () => {
  it("bloqueia clienteId adulterado antes de qualquer gravação", async () => {
    const tx = criarTx();
    tx.usuarios.findUnique.mockResolvedValue({ role: "Admin", status: "ATIVO" });
    tx.clienteServico.findMany.mockResolvedValue([clienteA]);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    await expect(salvarImportacao([{ ...linhaSocio, clienteId: 999 }], 7))
      .rejects.toMatchObject({ code: "INVALID_CLIENT_TARGET" });
    expect(tx.pessoa.upsert).not.toHaveBeenCalled();
    expect(tx.auditoria.create).not.toHaveBeenCalled();
  });

  it("salva sócios, CS e feedbacks juntos e audita o resumo", async () => {
    const tx = criarTx();
    tx.usuarios.findUnique.mockResolvedValue({ role: "Admin", status: "ATIVO" });
    tx.clienteServico.findMany.mockResolvedValue([clienteA]);
    tx.pessoa.upsert.mockResolvedValue({ id: 900 });
    tx.pessoaClienteVinculo.upsert.mockResolvedValue({ pessoaId: 900, clienteId: clienteA.clienteId });
    tx.clienteServicoLogCs.createMany.mockResolvedValue({ count: 1 });
    tx.clienteServicoLogFeedback.createMany.mockResolvedValue({ count: 1 });
    tx.auditoria.create.mockResolvedValue({ id: 1 });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    const resumo = await salvarImportacao([linhaSocio, linhaCs, linhaFeedback], 7);

    expect(tx.pessoa.upsert).toHaveBeenCalledWith({
      where: { celular: "0011999999999" },
      update: { nome: "Maria da Silva" },
      create: expect.objectContaining({ celular: "0011999999999", nome: "Maria da Silva" }),
    });
    expect(tx.pessoaClienteVinculo.upsert).toHaveBeenCalledWith({
      where: { pessoaId_clienteId: { pessoaId: 900, clienteId: clienteA.clienteId } },
      update: { vinculo: "Administradora" },
      create: { pessoaId: 900, clienteId: clienteA.clienteId, vinculo: "Administradora" },
    });
    expect(tx.clienteServicoLogCs.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ clienteServicoId: 10, colaborador: "Ana" })],
    });
    expect(tx.clienteServicoLogFeedback.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ clienteServicoId: 10, colaborador: "Carlos" })],
    });
    expect(tx.auditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 7, acao: "IMPORTAR_CS_NPS_SALVO" }),
      select: { id: true },
    });
    expect(resumo).toMatchObject({
      total: 3,
      socios: 1,
      cs: 1,
      feedbacks: 1,
      empresasAfetadas: 1,
    });
    expect(resumo.empresas[0]).toMatchObject({ total: 3, socios: 1, cs: 1, feedbacks: 1 });
  });

  it("propaga a falha da transação e não tenta auditar sucesso", async () => {
    const tx = criarTx();
    tx.usuarios.findUnique.mockResolvedValue({ role: "CEO", status: "ATIVO" });
    tx.clienteServico.findMany.mockResolvedValue([clienteA]);
    tx.clienteServicoLogCs.createMany.mockRejectedValue(new Error("banco indisponível"));
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    await expect(salvarImportacao([linhaCs], 7)).rejects.toThrow("banco indisponível");
    expect(tx.auditoria.create).not.toHaveBeenCalled();
  });

  it("rejeita ator que perdeu a autorização entre preview e confirmação", async () => {
    const tx = criarTx();
    tx.usuarios.findUnique.mockResolvedValue({ role: "Vendedor", status: "ATIVO" });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    await expect(salvarImportacao([linhaSocio], 7)).rejects.toEqual(
      expect.objectContaining<Partial<ErroImportacao>>({ code: "AUTHORIZATION_CHANGED" }),
    );
    expect(tx.clienteServico.findMany).not.toHaveBeenCalled();
  });
});

describe("validação de tipos", () => {
  it("rejeita combinações vazias", async () => {
    await expect(gerarModeloImportacao([] as TipoImportacao[])).rejects.toMatchObject({
      code: "INVALID_TYPES",
    });
  });
});
