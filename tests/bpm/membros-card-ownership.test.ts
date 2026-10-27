import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const prismaMock = vi.hoisted(() => ({
  usuarios: { findMany: vi.fn(), findUnique: vi.fn() },
  setorPermissao: { findMany: vi.fn() },
  usuarioPermissaoOverride: { findMany: vi.fn() },
  bpmPipeline: { findUnique: vi.fn() },
  bpmCard: { findUnique: vi.fn(), findFirst: vi.fn() },
  setor: { findMany: vi.fn() },
  bpmCardMembro: { findFirst: vi.fn(), findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  checarAcessoBpmCard,
  listarUsuariosVinculaveisBpm,
} from "@/lib/bpm/ownership";

describe("CRM - elegibilidade de pessoas vinculáveis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.usuarios.findMany.mockResolvedValue([
      { id: 1, nome: "Admin", imagemUrl: null, role: "Admin", status: "ATIVO", permissoes: null },
      { id: 2, nome: "Comercial", imagemUrl: "/comercial.webp", role: "Comercial", status: "ATIVO", permissoes: null },
      { id: 3, nome: "Inativo", imagemUrl: null, role: "Comercial", status: "INATIVO", permissoes: "crm" },
      { id: 4, nome: "Revogado", imagemUrl: null, role: "Financeiro", status: "ATIVO", permissoes: "crm" },
      { id: 5, nome: "Liberado", imagemUrl: "/liberado.webp", role: "Financeiro", status: "ATIVO", permissoes: null },
    ]);
    prismaMock.setorPermissao.findMany.mockResolvedValue([
      { setor: "Comercial", modulo: "crm" },
    ]);
    prismaMock.usuarioPermissaoOverride.findMany.mockResolvedValue([
      { usuarioId: 4, modulo: "crm", acao: "REMOVE" },
      { usuarioId: 5, modulo: "crm", acao: "ADD" },
    ]);
  });

  it("filtra por status ativo e permissão CRM efetiva, aplicando override e sem expor dados sensíveis", async () => {
    await expect(listarUsuariosVinculaveisBpm()).resolves.toEqual([
      { id: 1, nome: "Admin", imagemUrl: null },
      { id: 2, nome: "Comercial", imagemUrl: "/comercial.webp" },
      { id: 5, nome: "Liberado", imagemUrl: "/liberado.webp" },
    ]);
    expect(prismaMock.usuarios.findMany).toHaveBeenCalledWith({
      where: { status: "ATIVO" },
      select: {
        id: true,
        nome: true,
        imagemUrl: true,
        role: true,
        status: true,
        permissoes: true,
      },
      orderBy: { nome: "asc" },
    });
    expect(prismaMock.usuarioPermissaoOverride.findMany).toHaveBeenCalledWith({
      where: { usuarioId: { in: [1, 2, 3, 4, 5] } },
      select: { usuarioId: true, modulo: true, acao: true },
    });
  });

  it("permite que participante vinculado execute o trabalho do card, mas nunca gerencie pessoas ou exclua o card", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({
      id: 9,
      role: "COMERCIAL",
      status: "ATIVO",
      permissoes: "crm",
    });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ pipelineId: "pipeline", responsavelId: 3, pipeline: { setores: [] }, etapa: { nome: "Em Tratativa" } });
    prismaMock.bpmCardMembro.findUnique.mockResolvedValue({ role: "PARTICIPANTE" });
    prismaMock.usuarioPermissaoOverride.findMany.mockResolvedValue([]);

    for (const acao of [
      "visualizar",
      "editarCard",
      "moverEtapa",
      "criarTarefa",
      "concluirTarefa",
      "enviarArquivo",
      "excluirArquivo",
      "visualizarHistorico",
    ] as const) {
      await expect(
        checarAcessoBpmCard("clw0000000000000card", 9, "COMERCIAL", acao),
      ).resolves.toMatchObject({ autorizado: true, role: "PARTICIPANTE" });
    }
    await expect(
      checarAcessoBpmCard("clw0000000000000card", 9, "COMERCIAL", "adicionarParticipantes"),
    ).resolves.toMatchObject({ autorizado: false });
    await expect(
      checarAcessoBpmCard("clw0000000000000card", 9, "COMERCIAL", "excluirCard"),
    ).resolves.toMatchObject({ autorizado: false });
  });

  it("remoção do vínculo mantém consulta e revoga trabalho imediatamente", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({
      id: 9,
      role: "COMERCIAL",
      status: "ATIVO",
      permissoes: "crm",
    });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ pipelineId: "pipeline", responsavelId: 3, pipeline: { setores: [] }, etapa: { nome: "Em Tratativa" } });
    prismaMock.bpmCardMembro.findUnique.mockResolvedValue(null);
    prismaMock.usuarioPermissaoOverride.findMany.mockResolvedValue([]);

    await expect(
      checarAcessoBpmCard("clw0000000000000card", 9, "COMERCIAL", "visualizar"),
    ).resolves.toMatchObject({ autorizado: true, role: "VISUALIZADOR", podeAgirEtapa: false });
    await expect(
      checarAcessoBpmCard("clw0000000000000card", 9, "COMERCIAL", "editarCard"),
    ).resolves.toMatchObject({ autorizado: false, role: null });
  });

  it("mantém a listagem do board condicionada ao escopo autorizado no servidor", () => {
    const cardsAction = readFileSync(
      resolve(process.cwd(), "src/actions/bpm/Cards.ts"),
      "utf8",
    );
    expect(cardsAction).toContain("...escopoLeitura.where");
  });
});


describe("consulta compartilhada no pipeline no guard real", () => {
  const config = JSON.stringify({ version: 1, supervisores: [{ usuarioId: 9, setorIds: [2] }] });
  const card = (pipelineId = "permitido", visualizacaoConfigJson: string | null = config) => ({
    pipelineId, responsavelId: 20, status: "ATIVO", vinculosOrigem: [],
    pipeline: { setores: [], visualizacaoConfigJson }, etapa: { nome: "Tratativa", ehFinal: false, visibilidades: [] },
  });
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.usuarios.findUnique.mockResolvedValue({ id: 9, role: "COMERCIAL", status: "ATIVO", permissoes: "crm" });
    prismaMock.usuarioPermissaoOverride.findMany.mockResolvedValue([]);
    prismaMock.setorPermissao.findMany.mockResolvedValue([]);
    prismaMock.bpmCardMembro.findUnique.mockResolvedValue(null);
    prismaMock.bpmCard.findUnique.mockResolvedValue(card());
    prismaMock.setor.findMany.mockResolvedValue([{ id: 2, nome: "Operacional" }]);
    prismaMock.usuarios.findMany.mockResolvedValue([{ id: 20, role: "OPERACIONAL" }, { id: 30, role: "FINANCEIRO" }]);
    prismaMock.bpmCard.findFirst.mockResolvedValue({ id: "terceiro" });
  });
  it("permite somente leitura e histórico de terceiro da equipe, sem conceder mutações", async () => {
    for (const acao of ["visualizar", "visualizarHistorico"] as const) {
      await expect(checarAcessoBpmCard("terceiro", 9, "COMERCIAL", acao)).resolves.toMatchObject({
        autorizado: true, role: "VISUALIZADOR", podeAgirEtapa: false, isAdminGlobal: false,
      });
    }
    for (const acao of ["editarCard", "moverEtapa", "criarTarefa", "concluirTarefa", "enviarArquivo", "excluirArquivo", "adicionarParticipantes", "excluirCard"] as const) {
      await expect(checarAcessoBpmCard("terceiro", 9, "COMERCIAL", acao)).resolves.toMatchObject({ autorizado: false });
    }
    expect(prismaMock.bpmCard.findFirst).not.toHaveBeenCalled();
  });
  it("consulta não depende de configuração de supervisão nem do setor do responsável legado", async () => {
    for (const json of [null, JSON.stringify({ version: 1, supervisores: [] })]) {
      prismaMock.bpmCard.findUnique.mockResolvedValue(card("outro", json));
      await expect(checarAcessoBpmCard("outro-card", 9, "COMERCIAL", "visualizar")).resolves.toMatchObject({ autorizado: true, role: "VISUALIZADOR", podeAgirEtapa: false });
    }
    expect(prismaMock.bpmCard.findFirst).not.toHaveBeenCalled();
    prismaMock.bpmCard.findUnique.mockResolvedValue(card("outro", "{corrompido"));
    await expect(checarAcessoBpmCard("outro-card", 9, "COMERCIAL", "visualizar")).resolves.toMatchObject({ autorizado: false });
  });
  it("revoga consulta imediatamente quando CRM é removido ou conta desativada", async () => {
    prismaMock.usuarioPermissaoOverride.findMany.mockResolvedValue([{ modulo: "crm", acao: "REMOVE" }]);
    await expect(checarAcessoBpmCard("fora", 9, "COMERCIAL", "visualizar")).resolves.toMatchObject({ autorizado: false });
    prismaMock.usuarioPermissaoOverride.findMany.mockResolvedValue([]);
    prismaMock.usuarios.findUnique.mockResolvedValue({ id: 9, role: "COMERCIAL", status: "INATIVO", permissoes: "crm" });
    await expect(checarAcessoBpmCard("fora", 9, "COMERCIAL", "visualizar")).resolves.toMatchObject({ autorizado: false });
  });
  it("não ignora restrições de acesso ao pipeline ou coluna", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue({ ...card(), pipeline: { visualizacaoConfigJson: config, setores: [{ setor: { nome: "FINANCEIRO" } }] } });
    await expect(checarAcessoBpmCard("terceiro", 9, "COMERCIAL", "visualizar")).resolves.toMatchObject({ autorizado: false });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ ...card(), etapa: { nome: "Oculta", visibilidades: [{ perfil: "COMERCIAL", podeVer: false, podeAgir: false }] } });
    await expect(checarAcessoBpmCard("terceiro", 9, "COMERCIAL", "visualizar")).resolves.toMatchObject({ autorizado: false });
    expect(prismaMock.bpmCard.findFirst).not.toHaveBeenCalled();
  });
});
