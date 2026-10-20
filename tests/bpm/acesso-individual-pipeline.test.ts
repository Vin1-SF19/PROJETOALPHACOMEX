import { describe, expect, it, vi } from "vitest";
import { atualizarUsuariosAutorizadosPipeline, lerUsuariosAutorizadosPipeline } from "@/lib/bpm/acesso-individual-pipeline";
import { checarAcessoBpmPipeline, checarAcessoBpmCard, usuarioElegivelResponsavelBpm } from "@/lib/bpm/ownership";

const legado = { version: 1, supervisores: [{ usuarioId: 8, setorIds: [2] }], outraPropriedade: "preservar" };
const config = atualizarUsuariosAutorizadosPipeline(JSON.stringify(legado), [7, 7]);
function criarClient() {
  return {
    usuarios: { findUnique: vi.fn().mockResolvedValue({ id: 7, role: "Comercial", status: "ATIVO", permissoes: "crm" }) },
    setorPermissao: { findMany: vi.fn().mockResolvedValue([]) },
    usuarioPermissaoOverride: { findMany: vi.fn().mockResolvedValue([]) },
    bpmPipeline: { findUnique: vi.fn().mockResolvedValue({ visualizacaoConfigJson: config, setores: [{ setor: { nome: "Operacional" } }] }) },
    bpmCard: { findUnique: vi.fn().mockResolvedValue({ pipelineId: "outro", responsavelId: 9, status: "EM_ANDAMENTO", pipeline: { visualizacaoConfigJson: config, setores: [{ setor: { nome: "Operacional" } }] }, etapa: { nome: "Em análise", ehFinal: false, visibilidades: [] }, vinculosOrigem: [] }) },
    bpmCardMembro: { findUnique: vi.fn().mockResolvedValue(null) },
    setor: { findMany: vi.fn().mockResolvedValue([]) },
  };
}
type Client = Parameters<typeof checarAcessoBpmPipeline>[2];
describe("acesso individual de pipeline", () => {
  it("preserva legado, deduplica e falha fechado em JSON inválido", () => {
    expect(JSON.parse(config)).toEqual({ ...legado, usuariosAutorizados: [7] });
    for (const raw of [null, "{", '{"version":2,"usuariosAutorizados":[7]}', '{"version":1,"usuariosAutorizados":["7"]}', JSON.stringify(legado)]) expect(lerUsuariosAutorizadosPipeline(raw)).toEqual([]);
    expect(() => atualizarUsuariosAutorizadosPipeline("{", [7])).toThrow();
  });
  it("autoriza fora do setor, permite elegibilidade e revoga na próxima consulta", async () => {
    const db = criarClient(); const client = db as unknown as Client;
    expect(await checarAcessoBpmPipeline("p1", 7, client)).toBe(true);
    expect(await usuarioElegivelResponsavelBpm("p1", 7, client)).toBe(true);
    db.bpmPipeline.findUnique.mockResolvedValue({ visualizacaoConfigJson: atualizarUsuariosAutorizadosPipeline(config, []), setores: [{ setor: { nome: "Operacional" } }] });
    expect(await checarAcessoBpmPipeline("p1", 7, client)).toBe(false);
    expect(await usuarioElegivelResponsavelBpm("p1", 7, client)).toBe(false);
  });
  it("não contorna conta inativa ou CRM revogado", async () => {
    const db = criarClient(); const client = db as unknown as Client;
    db.usuarios.findUnique.mockResolvedValueOnce({ id: 7, role: "Comercial", status: "INATIVO", permissoes: "crm" });
    expect(await checarAcessoBpmPipeline("p1", 7, client)).toBe(false);
    db.usuarioPermissaoOverride.findMany.mockResolvedValue([{ modulo: "crm", acao: "REMOVE" }]);
    expect(await checarAcessoBpmPipeline("p1", 7, client)).toBe(false);
  });
  it("permite ler mas não editar card de terceiros e preserva restrição de coluna", async () => {
    const db = criarClient(); const client = db as unknown as Client;
    expect((await checarAcessoBpmCard("c1", 7, "TI", "visualizar", client)).autorizado).toBe(true);
    expect((await checarAcessoBpmCard("c1", 7, "TI", "editarCard", client)).autorizado).toBe(false);
    const card = await db.bpmCard.findUnique();
    db.bpmCard.findUnique.mockResolvedValue({ ...card, etapa: { ...card.etapa, visibilidades: [{ perfil: "OPERACIONAL", podeVer: true, podeAgir: true }] } });
    expect((await checarAcessoBpmCard("c1", 7, "TI", "visualizar", client)).autorizado).toBe(false);
  });
});
