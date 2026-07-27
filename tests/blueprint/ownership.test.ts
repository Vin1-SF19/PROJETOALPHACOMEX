import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  blueprintMember: { findUnique: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { checarAcessoBlueprint, exigirAcessoBlueprint } from "@/lib/blueprint/ownership";

describe("checarAcessoBlueprint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Admin global tem acesso pleno mesmo sem ser membro do projeto", async () => {
    const acesso = await checarAcessoBlueprint("proj1", 999, "Admin", "excluir");
    expect(acesso.autorizado).toBe(true);
    expect(acesso.isAdminGlobal).toBe(true);
    // Nunca deveria precisar consultar BlueprintMember para admin — economiza 1 query
    expect(prismaMock.blueprintMember.findUnique).not.toHaveBeenCalled();
  });

  it("CEO global tem acesso pleno", async () => {
    const acesso = await checarAcessoBlueprint("proj1", 1, "CEO", "arquivar");
    expect(acesso.autorizado).toBe(true);
  });

  it("usuário sem nenhum vínculo com o projeto é negado", async () => {
    prismaMock.blueprintMember.findUnique.mockResolvedValueOnce(null);
    const acesso = await checarAcessoBlueprint("proj1", 42, "User", "visualizar");
    expect(acesso.autorizado).toBe(false);
    expect(acesso.role).toBeNull();
  });

  it("VISUALIZADOR pode ver mas não pode editar documento", async () => {
    prismaMock.blueprintMember.findUnique.mockResolvedValue({ role: "VISUALIZADOR" });
    const podeVer = await checarAcessoBlueprint("proj1", 1, "User", "visualizar");
    const podeEditar = await checarAcessoBlueprint("proj1", 1, "User", "editarDocumento");
    expect(podeVer.autorizado).toBe(true);
    expect(podeEditar.autorizado).toBe(false);
  });

  it("COMENTARISTA pode usar IA mas não pode enviar arquivo", async () => {
    prismaMock.blueprintMember.findUnique.mockResolvedValue({ role: "COMENTARISTA" });
    const podeIA = await checarAcessoBlueprint("proj1", 1, "User", "usarIA");
    const podeUpload = await checarAcessoBlueprint("proj1", 1, "User", "enviarArquivo");
    expect(podeIA.autorizado).toBe(true);
    expect(podeUpload.autorizado).toBe(false);
  });

  it("EDITOR pode editar canvas mas não pode excluir o projeto", async () => {
    prismaMock.blueprintMember.findUnique.mockResolvedValue({ role: "EDITOR" });
    const podeEditarCanvas = await checarAcessoBlueprint("proj1", 1, "User", "editarCanvas");
    const podeExcluir = await checarAcessoBlueprint("proj1", 1, "User", "excluir");
    expect(podeEditarCanvas.autorizado).toBe(true);
    expect(podeExcluir.autorizado).toBe(false);
  });

  it("ADMINISTRADOR do projeto pode arquivar mas não pode excluir (só PROPRIETARIO exclui)", async () => {
    prismaMock.blueprintMember.findUnique.mockResolvedValue({ role: "ADMINISTRADOR" });
    const podeArquivar = await checarAcessoBlueprint("proj1", 1, "User", "arquivar");
    const podeExcluir = await checarAcessoBlueprint("proj1", 1, "User", "excluir");
    expect(podeArquivar.autorizado).toBe(true);
    expect(podeExcluir.autorizado).toBe(false);
  });

  it("PROPRIETARIO pode tudo dentro do projeto", async () => {
    prismaMock.blueprintMember.findUnique.mockResolvedValue({ role: "PROPRIETARIO" });
    const acoes = ["visualizar", "editarDadosGerais", "editarDocumento", "editarCanvas", "enviarArquivo", "excluirArquivo", "criarRequisito", "alterarStatus", "definirPrioridade", "adicionarParticipantes", "usarIA", "arquivar", "excluir", "visualizarAuditoria"] as const;
    for (const acao of acoes) {
      const acesso = await checarAcessoBlueprint("proj1", 1, "User", acao);
      expect(acesso.autorizado).toBe(true);
    }
  });

  it("role desconhecido/corrompido no banco nunca autoriza silenciosamente", async () => {
    prismaMock.blueprintMember.findUnique.mockResolvedValue({ role: "ROLE_QUE_NAO_EXISTE" });
    const acesso = await checarAcessoBlueprint("proj1", 1, "User", "visualizar");
    expect(acesso.autorizado).toBe(false);
  });
});

describe("exigirAcessoBlueprint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lança erro quando não autorizado (para a action abortar com try/catch)", async () => {
    prismaMock.blueprintMember.findUnique.mockResolvedValueOnce(null);
    await expect(exigirAcessoBlueprint("proj1", 1, "User", "excluir")).rejects.toThrow("Não autorizado");
  });

  it("resolve normalmente quando autorizado", async () => {
    prismaMock.blueprintMember.findUnique.mockResolvedValueOnce({ role: "PROPRIETARIO" });
    await expect(exigirAcessoBlueprint("proj1", 1, "User", "excluir")).resolves.toMatchObject({ autorizado: true });
  });
});
