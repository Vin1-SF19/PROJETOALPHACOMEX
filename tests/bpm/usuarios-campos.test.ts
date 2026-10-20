import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { carregarUsuariosCamposBpm } from "@/lib/bpm/usuarios-campos-server";
import { nomeUsuarioCampoBpm } from "@/lib/bpm/usuarios-campos";
import { carregarCamposAplicaveisCardEtapa, type CampoAplicavelEtapaBpm } from "@/lib/bpm/requisitos-etapa-server";

describe("nomes de usuários nos campos do CRM", () => {
  it("consulta IDs em lote, mantém nomes de inativos e não troca por responsável atual", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 42, nome: "Closer original", status: "INATIVO" }]);
    const usuarios = await carregarUsuariosCamposBpm(["42", "42", null, "Nome legado"], false, { usuarios: { findMany } } as never);
    expect(findMany).toHaveBeenCalledOnce();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: [42] } }, select: { id: true, nome: true, status: true },
    }));
    expect(nomeUsuarioCampoBpm("42", usuarios)).toBe("Closer original");
    expect(nomeUsuarioCampoBpm("999", usuarios)).toBe("Usuário indisponível");
    expect(nomeUsuarioCampoBpm(null, usuarios)).toBe("");
  });

  it("não consulta usuários quando não há referências nem seleção editável", async () => {
    const findMany = vi.fn();
    expect(await carregarUsuariosCamposBpm([null, "Nome legado"], false, { usuarios: { findMany } } as never)).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("enriquece campo local e global preservando valores canônicos e snapshots", async () => {
    const base: CampoAplicavelEtapaBpm = {
      id: "local", nome: "Vendedor responsável", chave: "alpha.vendedor.a", tipo: "usuario",
      pipelineId: "pipeline", etapaId: "etapa", opcoesJson: null, obrigatorio: false, ordem: 0,
      escopo: "CARD", valor: null, visivel: true,
    };
    const client = {
      bpmCardCampoValor: { findMany: vi.fn().mockResolvedValue([{ campoId: "local", valor: "42" }]) },
      bpmCard: { findUnique: vi.fn().mockResolvedValue({
        id: "card", empresaId: 1, responsavelId: 51, responsavel: { id: 51, nome: "Responsável atual" },
        empresa: { pessoas: [] }, indicacaoOrigem: null,
      }) },
      usuarios: { findMany: vi.fn().mockResolvedValue([
        { id: 42, nome: "Closer original", status: "INATIVO" },
        { id: 51, nome: "Responsável atual", status: "ATIVO" },
      ]) },
    };
    const campos = await carregarCamposAplicaveisCardEtapa("card", "pipeline", "etapa", client as never, undefined, [
      base, { ...base, id: "global", escopo: "GLOBAL", fonteEntidade: "CARD",
        fonteAtributo: "responsavelId", somenteLeitura: true },
    ]);
    expect(campos[0]).toMatchObject({ valor: "42", usuariosOpcoes: [
      { id: 42, nome: "Closer original", ativo: false }, { id: 51, nome: "Responsável atual", ativo: true },
    ] });
    expect(campos[1]).toMatchObject({ valor: "51", usuariosOpcoes: [{ id: 51, nome: "Responsável atual", ativo: true }] });
    expect(client.usuarios.findMany).toHaveBeenCalledOnce();
  });
});
