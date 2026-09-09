import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  carregarCamposAplicaveisCardEtapa,
  carregarCamposFaltantesCardEtapa,
  carregarCamposObrigatoriosEtapa,
} from "@/lib/bpm/requisitos-etapa-server";

function criarCliente(overrides: Record<string, unknown>) {
  return {
    bpmCampo: { findMany: vi.fn().mockResolvedValue([]) },
    bpmCampoObrigatorioEtapa: { findMany: vi.fn().mockResolvedValue([]) },
    bpmCampoOcultoEtapa: { findMany: vi.fn().mockResolvedValue([]) },
    bpmCardCampoValor: { findMany: vi.fn().mockResolvedValue([]) },
    bpmCard: { findUnique: vi.fn().mockResolvedValue(null) },
    ...overrides,
  };
}

function configEtapa(etapaId: string, patch: Record<string, unknown> = {}) {
  return {
    etapaId,
    visivel: true,
    editavel: true,
    somenteLeitura: false,
    obrigatorio: false,
    obrigatorioEntrada: false,
    obrigatorioSaida: false,
    ordem: 0,
    ...patch,
  };
}

describe("campos aplicáveis por etapa", () => {
  it("retorna somente campos diretos e globais explicitamente associados", async () => {
    const client = criarCliente({
      bpmCampo: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "campo-direto",
            pipelineId: "pipeline-1",
            etapaId: "etapa-2",
            nome: "Campo da etapa",
            tipo: "texto",
            opcoesJson: null,
            obrigatorio: false,
            ordem: 2,
            etapaConfiguracoes: [configEtapa("etapa-2", { ordem: 2 })],
          },
          {
            id: "campo-global-associado",
            pipelineId: "pipeline-1",
            etapaId: null,
            nome: "Campo global associado",
            tipo: "numero",
            opcoesJson: null,
            obrigatorio: false,
            ordem: 1,
            etapaConfiguracoes: [configEtapa("etapa-2", { ordem: 1, obrigatorio: true })],
          },
        ]),
      },
      bpmCardCampoValor: {
        findMany: vi.fn().mockResolvedValue([
          { campoId: "campo-direto", valor: "valor existente" },
        ]),
      },
    });

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-1",
      "pipeline-1",
      "etapa-2",
      client as never,
    );

    expect(client.bpmCampo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        ativo: true,
        etapaConfiguracoes: { some: { etapaId: "etapa-2" } },
        OR: expect.arrayContaining([
          { pipelineId: "pipeline-1" },
        ]),
      }),
    }));
    expect(campos.map((campo) => campo.id)).toEqual([
      "campo-global-associado",
      "campo-direto",
    ]);
    expect(campos[0]).toMatchObject({ obrigatorio: true, valor: null });
    expect(campos[1]).toMatchObject({
      obrigatorio: false,
      valor: "valor existente",
    });
  });

  it("prioriza a configuração atual da etapa sobre associação obrigatória legada", async () => {
    const campo = {
      id: "campo-reuniao",
      pipelineId: "pipeline-radar",
      etapaId: null,
      nome: "Mês para protocolar",
      tipo: "texto",
      opcoesJson: null,
      obrigatorio: false,
      ordem: 1,
      etapaConfiguracoes: [{
        etapaId: "reuniao-agendada",
        visivel: true,
        editavel: true,
        somenteLeitura: false,
        obrigatorio: false,
        obrigatorioEntrada: false,
        obrigatorioSaida: false,
        ordem: 1,
      }],
    };
    const client = criarCliente({
      bpmCampo: { findMany: vi.fn().mockResolvedValue([campo]) },
      bpmCampoObrigatorioEtapa: {
        findMany: vi.fn().mockResolvedValue([{ campo }]),
      },
    });

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-1",
      "pipeline-radar",
      "reuniao-agendada",
      client as never,
    );

    expect(campos).toHaveLength(1);
    expect(campos[0]).toMatchObject({
      id: "campo-reuniao",
      obrigatorio: false,
    });
  });

  it("inclui campo base global somente quando há configuração canônica na etapa", async () => {
    const client = criarCliente({
      bpmCampo: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "campo-global-direto",
            pipelineId: "pipeline-1",
            etapaId: null,
            nome: "CNPJ",
            tipo: "texto",
            opcoesJson: null,
            obrigatorio: false,
            ordem: 1,
            etapaConfiguracoes: [configEtapa("etapa-qualquer", { ordem: 1 })],
          },
        ]),
      },
      bpmCampoObrigatorioEtapa: { findMany: vi.fn().mockResolvedValue([]) },
      bpmCardCampoValor: {
        findMany: vi.fn().mockResolvedValue([
          { campoId: "campo-global-direto", valor: "12.345.678/0001-90" },
        ]),
      },
    });

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-1",
      "pipeline-1",
      "etapa-qualquer",
      client as never,
    );

    expect(client.bpmCampo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        ativo: true,
        etapaConfiguracoes: { some: { etapaId: "etapa-qualquer" } },
        OR: expect.arrayContaining([
          { pipelineId: "pipeline-1" },
        ]),
      }),
    }));
    expect(campos).toHaveLength(1);
    expect(campos[0]).toMatchObject({
      id: "campo-global-direto",
      obrigatorio: false,
      valor: "12.345.678/0001-90",
    });
  });

  it("deduplica campo direto também associado e preserva obrigatoriedade efetiva", async () => {
    const campo = {
      id: "campo-reutilizado",
      pipelineId: "pipeline-1",
      etapaId: "etapa-2",
      nome: "Campo reutilizado",
      tipo: "texto",
      opcoesJson: null,
      obrigatorio: false,
      ordem: 1,
      etapaConfiguracoes: [configEtapa("etapa-2", { ordem: 1, obrigatorio: true })],
    };
    const client = criarCliente({
      bpmCampo: { findMany: vi.fn().mockResolvedValue([campo]) },
      bpmCampoObrigatorioEtapa: {
        findMany: vi.fn().mockResolvedValue([{ campo }]),
      },
      bpmCardCampoValor: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-1",
      "pipeline-1",
      "etapa-2",
      client as never,
    );
    expect(campos).toHaveLength(1);
    expect(campos[0].obrigatorio).toBe(true);
  });

  it("preserva a definição sem valor, ordena por ordem/nome e não duplica associação", async () => {
    const campoRepetido = {
      id: "campo-repetido",
      pipelineId: "pipeline-1",
      etapaId: "etapa-2",
      nome: "Zeta",
      tipo: "texto",
      opcoesJson: null,
      obrigatorio: false,
      ordem: 2,
      etapaConfiguracoes: [configEtapa("etapa-2", { ordem: 2, obrigatorio: true })],
    };
    const client = criarCliente({
      bpmCampo: {
        findMany: vi.fn().mockResolvedValue([
          campoRepetido,
          {
            id: "campo-alpha",
            pipelineId: "pipeline-1",
            etapaId: "etapa-2",
            nome: "Alpha",
            tipo: "texto",
            opcoesJson: null,
            obrigatorio: false,
            ordem: 2,
            etapaConfiguracoes: [configEtapa("etapa-2", { ordem: 2 })],
          },
          {
            id: "campo-primeiro",
            pipelineId: "pipeline-1",
            etapaId: null,
            nome: "Obrigatório primeiro",
            tipo: "texto",
            opcoesJson: null,
            obrigatorio: false,
            ordem: 1,
            etapaConfiguracoes: [configEtapa("etapa-2", { ordem: 1, obrigatorio: true })],
          },
        ]),
      },
      bpmCardCampoValor: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-1",
      "pipeline-1",
      "etapa-2",
      client as never,
    );

    expect(campos.map((campo) => campo.id)).toEqual([
      "campo-primeiro",
      "campo-alpha",
      "campo-repetido",
    ]);
    expect(campos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "campo-primeiro", obrigatorio: true, valor: null }),
      expect.objectContaining({ id: "campo-repetido", obrigatorio: true, valor: null }),
      expect.objectContaining({ id: "campo-alpha", obrigatorio: false, valor: null }),
    ]));
  });

  it("campo global sem valor salvo aparece com valor null, não é omitido", async () => {
    const client = criarCliente({
      bpmCampo: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "campo-global-vazio",
            pipelineId: "pipeline-1",
            etapaId: null,
            nome: "Radar pretendido",
            tipo: "texto",
            opcoesJson: null,
            obrigatorio: false,
            ordem: 1,
            etapaConfiguracoes: [configEtapa("etapa-qualquer", { ordem: 1 })],
          },
        ]),
      },
      bpmCampoObrigatorioEtapa: { findMany: vi.fn().mockResolvedValue([]) },
      bpmCardCampoValor: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-1",
      "pipeline-1",
      "etapa-qualquer",
      client as never,
    );

    expect(campos).toHaveLength(1);
    expect(campos[0]).toMatchObject({ id: "campo-global-vazio", valor: null });
  });

  it("ignora ocultação legada quando a configuração canônica deixa o campo visível", async () => {
    const campo = {
      id: "confirmar-servico",
      pipelineId: "pipeline-1",
      etapaId: null,
      nome: "Confirmar serviço",
      tipo: "texto",
      opcoesJson: null,
      obrigatorio: false,
      ordem: 4,
      etapaConfiguracoes: [configEtapa("novos-leads", { ordem: 4 })],
    };
    const client = criarCliente({
      bpmCampo: { findMany: vi.fn().mockResolvedValue([campo]) },
      bpmCampoObrigatorioEtapa: {
        findMany: vi.fn().mockResolvedValue([{ campo }]),
      },
      bpmCampoOcultoEtapa: {
        findMany: vi.fn().mockResolvedValue([{ campoId: campo.id }]),
      },
    });

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-legado",
      "pipeline-1",
      "novos-leads",
      client as never,
    );

    expect(campos).toHaveLength(1);
    expect(campos[0].id).toBe(campo.id);
  });

  it("aplica visibilidade e somente leitura do perfil no servidor", async () => {
    const base = {
      pipelineId: "pipeline-1",
      etapaId: "etapa-2",
      tipo: "texto",
      opcoesJson: null,
      obrigatorio: false,
      ordem: 1,
      visivel: true,
      editavel: true,
      somenteLeitura: false,
      etapaConfiguracoes: [configEtapa("etapa-2", { ordem: 1 })],
    };
    const client = criarCliente({
      bpmCampo: {
        findMany: vi.fn().mockResolvedValue([
          {
            ...base,
            id: "campo-oculto-membro",
            nome: "Segredo interno",
            acessos: [{ perfil: "MEMBRO", visivel: false, editavel: false, somenteLeitura: true, obrigatorio: false }],
          },
          {
            ...base,
            id: "campo-leitura-membro",
            nome: "Resultado automático",
            acessos: [{ perfil: "MEMBRO", visivel: true, editavel: false, somenteLeitura: true, obrigatorio: false }],
          },
        ]),
      },
    });

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-1",
      "pipeline-1",
      "etapa-2",
      client as never,
      "MEMBRO",
    );

    expect(campos).toHaveLength(1);
    expect(campos[0]).toMatchObject({
      id: "campo-leitura-membro",
      visivel: true,
      editavel: false,
      somenteLeitura: true,
    });
  });

  it("hidrata CNPJ e contato inequívoco da entidade mestre sem sobrescrever valor local", async () => {
    const camposConfigurados = [
      {
        id: "cnpj",
        pipelineId: "pipeline-1",
        etapaId: null,
        nome: "CNPJ",
        tipo: "texto",
        opcoesJson: null,
        obrigatorio: false,
        ordem: 1,
        etapaConfiguracoes: [configEtapa("novos-leads", { ordem: 1 })],
      },
      {
        id: "responsavel",
        pipelineId: "pipeline-1",
        etapaId: null,
        nome: "Nome do responsável",
        tipo: "texto",
        opcoesJson: null,
        obrigatorio: false,
        ordem: 2,
        etapaConfiguracoes: [configEtapa("novos-leads", { ordem: 2 })],
      },
      {
        id: "email",
        pipelineId: "pipeline-1",
        etapaId: null,
        nome: "E-mail",
        tipo: "texto",
        opcoesJson: null,
        obrigatorio: false,
        ordem: 3,
        etapaConfiguracoes: [configEtapa("novos-leads", { ordem: 3 })],
      },
    ];
    const client = criarCliente({
      bpmCampo: { findMany: vi.fn().mockResolvedValue(camposConfigurados) },
      bpmCardCampoValor: {
        findMany: vi.fn().mockResolvedValue([{ campoId: "email", valor: "local@exemplo.com" }]),
      },
      bpmCard: {
        findUnique: vi.fn().mockResolvedValue({
          empresa: {
            cnpj: "12345678000190",
            razaoSocial: "Alpha Ltda",
            nomeFantasia: "Alpha",
            pessoas: [{
              principal: true,
              pessoa: {
                nome: "Maria",
                celular: "11999999999",
                email: "mestre@exemplo.com",
                telefoneExtra: null,
              },
            }],
          },
        }),
      },
    });

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-legado",
      "pipeline-1",
      "novos-leads",
      client as never,
    );

    expect(Object.fromEntries(campos.map((campo) => [campo.nome, campo.valor]))).toEqual({
      CNPJ: "12345678000190",
      "Nome do responsável": "Maria",
      "E-mail": "local@exemplo.com",
    });
  });
});

describe("campos obrigatórios por etapa (validação de transição)", () => {
  it("inclui campo global marcado como obrigatório na configuração canônica", async () => {
    const client = criarCliente({
      bpmCampo: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "campo-global-obrigatorio",
            pipelineId: "pipeline-1",
            etapaId: null,
            nome: "CNPJ",
            tipo: "texto",
            opcoesJson: null,
            obrigatorio: false,
            ordem: 1,
            etapaConfiguracoes: [configEtapa("etapa-2", { ordem: 1, obrigatorio: true })],
          },
        ]),
      },
    });

    const campos = await carregarCamposObrigatoriosEtapa(
      "pipeline-1",
      "etapa-2",
      client as never,
    );

    expect(client.bpmCampo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        ativo: true,
        etapaConfiguracoes: { some: { etapaId: "etapa-2" } },
        OR: expect.arrayContaining([
          { pipelineId: "pipeline-1" },
        ]),
      }),
    }));
    expect(campos).toEqual([{ id: "campo-global-obrigatorio", nome: "CNPJ" }]);
  });

  it("considera CNPJ mestre preenchido ao validar card legado", async () => {
    const campo = {
      id: "cnpj",
      pipelineId: "pipeline-1",
      etapaId: null,
      nome: "CNPJ",
      tipo: "texto",
      opcoesJson: null,
      obrigatorio: false,
      ordem: 1,
      etapaConfiguracoes: [configEtapa("novos-leads", { ordem: 1, obrigatorio: true })],
    };
    const client = criarCliente({
      bpmCampo: { findMany: vi.fn().mockResolvedValue([campo]) },
      bpmCampoObrigatorioEtapa: {
        findMany: vi.fn().mockResolvedValue([{ campo }]),
      },
      bpmCard: {
        findUnique: vi.fn().mockResolvedValue({
          empresa: {
            cnpj: "12345678000190",
            razaoSocial: "Alpha Ltda",
            nomeFantasia: null,
            pessoas: [],
          },
        }),
      },
    });

    const faltantes = await carregarCamposFaltantesCardEtapa(
      "card-antigo",
      "pipeline-1",
      "novos-leads",
      client as never,
    );

    expect(faltantes).toEqual([]);
  });
});
