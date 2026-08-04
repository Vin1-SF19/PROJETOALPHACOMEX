import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const getPermissoesEfetivasMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  justificativaMeta: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/actions/PermissoesSetor", () => ({
  getPermissoesEfetivas: getPermissoesEfetivasMock,
}));

import {
  BuscarJustificativaVigente,
  RegistrarJustificativaMeta,
} from "@/actions/JustificativaMeta";

const REGISTRO_BASE = {
  id: "reg-1",
  mes: 6,
  ano: 2026,
  nomeArquivo: "justificativa-junho.pdf",
  tamanhoBytes: 12345,
  createdAt: new Date("2026-06-10T12:00:00Z"),
  enviadoPor: { nome: "Ana Líder" },
};

const URL_BLOB_VALIDA = "https://xyz123abc.public.blob.vercel-storage.com/justificativas-meta/2026-06/arquivo-abc123.pdf";

function sessaoAdmin() {
  return { user: { id: "1", role: "Admin" } };
}

function sessaoLiderComercial() {
  return { user: { id: "2", role: "Lider Comercial" } };
}

function sessaoComercialComum() {
  return { user: { id: "3", role: "COMERCIAL" } };
}

describe("BuscarJustificativaVigente — validação de período (edge cases)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(sessaoAdmin());
    prismaMock.justificativaMeta.findFirst.mockResolvedValue(REGISTRO_BASE);
  });

  it("aceita mes=1 e mes=12 (limites exatos)", async () => {
    await expect(BuscarJustificativaVigente(1, 2026)).resolves.toMatchObject({ success: true });
    await expect(BuscarJustificativaVigente(12, 2026)).resolves.toMatchObject({ success: true });
  });

  it("aceita ano=2020 e ano=2100 (limites exatos)", async () => {
    await expect(BuscarJustificativaVigente(6, 2020)).resolves.toMatchObject({ success: true });
    await expect(BuscarJustificativaVigente(6, 2100)).resolves.toMatchObject({ success: true });
  });

  it("rejeita mes=0", async () => {
    const resultado = await BuscarJustificativaVigente(0, 2026);
    expect(resultado).toEqual({ success: false, error: "Período inválido" });
  });

  it("rejeita mes=13", async () => {
    const resultado = await BuscarJustificativaVigente(13, 2026);
    expect(resultado).toEqual({ success: false, error: "Período inválido" });
  });

  it("rejeita mes não-inteiro (1.5)", async () => {
    const resultado = await BuscarJustificativaVigente(1.5, 2026);
    expect(resultado).toEqual({ success: false, error: "Período inválido" });
  });

  it("rejeita ano=2019 (abaixo do mínimo)", async () => {
    const resultado = await BuscarJustificativaVigente(6, 2019);
    expect(resultado).toEqual({ success: false, error: "Período inválido" });
  });

  it("rejeita ano=2101 (acima do máximo)", async () => {
    const resultado = await BuscarJustificativaVigente(6, 2101);
    expect(resultado).toEqual({ success: false, error: "Período inválido" });
  });

  it("não consulta o banco quando o período é inválido", async () => {
    await BuscarJustificativaVigente(13, 2026);
    expect(prismaMock.justificativaMeta.findFirst).not.toHaveBeenCalled();
  });
});

describe("BuscarJustificativaVigente / ListarHistoricoJustificativas — autorização de leitura", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.justificativaMeta.findFirst.mockResolvedValue(REGISTRO_BASE);
  });

  it("nega acesso sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const resultado = await BuscarJustificativaVigente(6, 2026);
    expect(resultado).toEqual({ success: false, error: "Não autenticado" });
  });

  it("permite leitura para quem pode gerenciar metas, sem consultar permissões granulares", async () => {
    authMock.mockResolvedValue(sessaoAdmin());
    await BuscarJustificativaVigente(6, 2026);
    expect(getPermissoesEfetivasMock).not.toHaveBeenCalled();
  });

  it("permite leitura para comum do Comercial com permissão efetiva 'metas'", async () => {
    authMock.mockResolvedValue(sessaoComercialComum());
    getPermissoesEfetivasMock.mockResolvedValue(["metas", "outraPermissao"]);

    const resultado = await BuscarJustificativaVigente(6, 2026);
    expect(resultado.success).toBe(true);
  });

  it("nega leitura para usuário sem a permissão efetiva 'metas'", async () => {
    authMock.mockResolvedValue(sessaoComercialComum());
    getPermissoesEfetivasMock.mockResolvedValue(["outroModulo"]);

    const resultado = await BuscarJustificativaVigente(6, 2026);
    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
  });
});

describe("RegistrarJustificativaMeta — autorização de escrita", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.justificativaMeta.create.mockResolvedValue(REGISTRO_BASE);
  });

  const inputValido = {
    mes: 6,
    ano: 2026,
    url: URL_BLOB_VALIDA,
    nomeArquivo: "justificativa-junho.pdf",
    tamanhoBytes: 12345,
  };

  it("nega sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const resultado = await RegistrarJustificativaMeta(inputValido);
    expect(resultado).toEqual({ success: false, error: "Não autenticado" });
    expect(prismaMock.justificativaMeta.create).not.toHaveBeenCalled();
  });

  it("nega para membro comum do Comercial mesmo com permissão de leitura 'metas'", async () => {
    authMock.mockResolvedValue(sessaoComercialComum());
    getPermissoesEfetivasMock.mockResolvedValue(["metas"]);

    const resultado = await RegistrarJustificativaMeta(inputValido);
    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.justificativaMeta.create).not.toHaveBeenCalled();
  });

  it("permite para Admin", async () => {
    authMock.mockResolvedValue(sessaoAdmin());
    const resultado = await RegistrarJustificativaMeta(inputValido);
    expect(resultado.success).toBe(true);
  });

  it("permite para Lider Comercial", async () => {
    authMock.mockResolvedValue(sessaoLiderComercial());
    const resultado = await RegistrarJustificativaMeta(inputValido);
    expect(resultado.success).toBe(true);
  });
});

describe("RegistrarJustificativaMeta — allowlist de domínio da URL (fix pós-auditoria Anubis)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(sessaoAdmin());
    prismaMock.justificativaMeta.create.mockResolvedValue(REGISTRO_BASE);
  });

  it("aceita URL do domínio correto do Blob Store", async () => {
    const resultado = await RegistrarJustificativaMeta({
      mes: 6,
      ano: 2026,
      url: URL_BLOB_VALIDA,
      nomeArquivo: "arquivo.pdf",
      tamanhoBytes: 100,
    });
    expect(resultado.success).toBe(true);
    expect(prismaMock.justificativaMeta.create).toHaveBeenCalledTimes(1);
  });

  it("rejeita URL de domínio externo (ex.: tentativa de registrar link malicioso)", async () => {
    const resultado = await RegistrarJustificativaMeta({
      mes: 6,
      ano: 2026,
      url: "https://evil.com/arquivo.pdf",
      nomeArquivo: "arquivo.pdf",
      tamanhoBytes: 100,
    });
    expect(resultado).toEqual({ success: false, error: "Dados inválidos" });
    expect(prismaMock.justificativaMeta.create).not.toHaveBeenCalled();
  });

  it("rejeita URL malformada sem lançar exceção", async () => {
    const resultado = await RegistrarJustificativaMeta({
      mes: 6,
      ano: 2026,
      url: "nao-e-uma-url",
      nomeArquivo: "arquivo.pdf",
      tamanhoBytes: 100,
    });
    expect(resultado).toEqual({ success: false, error: "Dados inválidos" });
  });

  it("rejeita domínio parecido mas fora da allowlist (ex.: subdomínio falso)", async () => {
    const resultado = await RegistrarJustificativaMeta({
      mes: 6,
      ano: 2026,
      url: "https://blob.vercel-storage.com.evil.com/arquivo.pdf",
      nomeArquivo: "arquivo.pdf",
      tamanhoBytes: 100,
    });
    expect(resultado).toEqual({ success: false, error: "Dados inválidos" });
  });
});

describe("RegistrarJustificativaMeta — tipoArquivo nunca vem do input do client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(sessaoAdmin());
    prismaMock.justificativaMeta.create.mockResolvedValue(REGISTRO_BASE);
  });

  it("grava tipoArquivo fixo 'application/pdf' independente do que for passado no input", async () => {
    const inputComCampoExtra = {
      mes: 6,
      ano: 2026,
      url: URL_BLOB_VALIDA,
      nomeArquivo: "arquivo.pdf",
      tamanhoBytes: 100,
      tipoArquivo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    await RegistrarJustificativaMeta(inputComCampoExtra as never);

    expect(prismaMock.justificativaMeta.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipoArquivo: "application/pdf" }),
      }),
    );
  });
});

describe("RegistrarJustificativaMeta — histórico nunca sobrescreve (sempre create, nunca update)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(sessaoAdmin());
    prismaMock.justificativaMeta.create.mockResolvedValue(REGISTRO_BASE);
  });

  it("duas chamadas para o MESMO mes/ano resultam em duas chamadas de create, nunca update", async () => {
    const input = {
      mes: 6,
      ano: 2026,
      url: URL_BLOB_VALIDA,
      nomeArquivo: "versao-1.pdf",
      tamanhoBytes: 100,
    };

    await RegistrarJustificativaMeta(input);
    await RegistrarJustificativaMeta({ ...input, nomeArquivo: "versao-2.pdf" });

    expect(prismaMock.justificativaMeta.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.justificativaMeta.update).not.toHaveBeenCalled();
  });

  it("BuscarJustificativaVigente consulta orderBy createdAt desc — garante que a mais recente é a vigente", async () => {
    prismaMock.justificativaMeta.findFirst.mockResolvedValue(REGISTRO_BASE);
    await BuscarJustificativaVigente(6, 2026);

    expect(prismaMock.justificativaMeta.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { mes: 6, ano: 2026 },
        orderBy: { createdAt: "desc" },
      }),
    );
  });
});
