import { describe, expect, it, vi } from "vitest";
import { gravarRegrasAcessoPipeline, lerRegrasAcessoPipeline, regrasAcessoPipelineSchema, resolverNivelAcessoPipeline, resolverAutoridadeAdministrativaPipeline, type RegraAcessoPipeline } from "@/lib/bpm/acesso-pipeline";
import { checarAcessoBpmPipeline, checarAcessoBpmCard, usuarioElegivelResponsavelBpm, checarAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { PIPELINE_OPERACIONAL_ATIVO_ID } from "@/lib/bpm/boas-vindas";

const setores = [{ id: 3, nome: "Operacional", ativo: true }];
const regra: RegraAcessoPipeline = { tipo: "USUARIO", id: 7, nivel: "PADRAO" };
function criarClient(regras: RegraAcessoPipeline[] = [regra]) {
  const config = gravarRegrasAcessoPipeline(null, regras);
  return {
    usuarios: { findUnique: vi.fn().mockResolvedValue({ id: 7, role: "Comercial", status: "ATIVO", permissoes: "crm" }) },
    setorPermissao: { findMany: vi.fn().mockResolvedValue([]) },
    usuarioPermissaoOverride: { findMany: vi.fn().mockResolvedValue([]) },
    bpmPipeline: { findUnique: vi.fn().mockResolvedValue({ visualizacaoConfigJson: config, setores: setores.map((setor) => ({ setor })) }) },
    bpmCard: { findUnique: vi.fn().mockResolvedValue({ pipelineId: "outro", responsavelId: 9, status: "ATIVO", pipeline: { ativo: true, visualizacaoConfigJson: config, setores: setores.map((setor) => ({ setor })) }, etapa: { nome: "Em análise", ehFinal: false, visibilidades: [] }, vinculosOrigem: [] }) },
    bpmCardMembro: { findUnique: vi.fn().mockResolvedValue(null) },
    setor: { findMany: vi.fn().mockResolvedValue([]) },
  };
}
type Client = Parameters<typeof checarAcessoBpmPipeline>[2];

describe("política explícita de acesso ao funil", () => {
  it("substitui chaves antigas e preserva distribuição de closers", () => {
    const closers = { ativa: true, usuariosIds: [7], ultimoUsuarioId: 7 };
    const anterior = JSON.stringify({ version: 1, supervisores: [{ usuarioId: 8, setorIds: [3] }], usuariosAutorizados: [7], distribuicaoClosers: closers });
    expect(lerRegrasAcessoPipeline(anterior, setores)).toEqual([{ tipo: "SETOR", id: 3, nivel: "PADRAO" }, regra]);
    expect(JSON.parse(gravarRegrasAcessoPipeline(anterior, [regra]))).toEqual({ distribuicaoClosers: closers, permissoesPipeline: { version: 2, regras: [regra] } });
    expect(() => gravarRegrasAcessoPipeline("{", [])).toThrow();
  });
  it("rejeita duplicatas, identidades inválidas e chaves desconhecidas", () => {
    for (const regras of [[regra, regra], [{ ...regra, id: -1 }], [{ ...regra, admin: true }], [{ ...regra, nivel: "ADMIN" }]]) {
      expect(regrasAcessoPipelineSchema.safeParse(regras).success).toBe(false);
    }
  });
  it("configuração vazia ou inválida não concede acesso e nunca infere liderança", () => {
    for (const json of [gravarRegrasAcessoPipeline(null, []), "{", '{"permissoesPipeline":{"version":9,"regras":[]}}']) {
      expect(resolverNivelAcessoPipeline({ usuarioId: 10, role: "Lider Operacional", setoresPipeline: setores, visualizacaoConfigJson: json })).toBeNull();
    }
    expect(resolverAutoridadeAdministrativaPipeline({ usuarioId: 10, role: "Operacional", setoresPipeline: setores })).toBeNull();
  });
  it("regra setorial usa identidade ativa e nível administrativo prevalece", () => {
    const visualizacaoConfigJson = gravarRegrasAcessoPipeline(null, [{ tipo: "SETOR", id: 3, nivel: "ADMINISTRATIVO" }, regra]);
    const entrada = { usuarioId: 7, role: "Operacional", setoresPipeline: setores, visualizacaoConfigJson };
    expect(resolverNivelAcessoPipeline(entrada)).toBe("ADMINISTRATIVO");
    expect(resolverNivelAcessoPipeline({ ...entrada, setoresPipeline: [{ ...setores[0], ativo: false }] })).toBe("PADRAO");
    expect(resolverNivelAcessoPipeline({ ...entrada, usuarioId: 8, setoresPipeline: [{ ...setores[0], id: 4 }] })).toBeNull();
  });
  it("autoriza pessoa fora do setor, permite atribuição e revoga na próxima consulta", async () => {
    const db = criarClient(); const client = db as unknown as Client;
    expect(await checarAcessoBpmPipeline("p1", 7, client)).toBe(true);
    expect(await usuarioElegivelResponsavelBpm("p1", 7, client)).toBe(true);
    db.bpmPipeline.findUnique.mockResolvedValue({ visualizacaoConfigJson: gravarRegrasAcessoPipeline(null, []), setores: [] });
    expect(await checarAcessoBpmPipeline("p1", 7, client)).toBe(false);
    expect(await usuarioElegivelResponsavelBpm("p1", 7, client)).toBe(false);
  });
  it("nega conta inativa ou CRM revogado mesmo com concessão administrativa", async () => {
    const db = criarClient([{ ...regra, nivel: "ADMINISTRATIVO" }]); const client = db as unknown as Client;
    db.usuarios.findUnique.mockResolvedValueOnce({ id: 7, role: "Comercial", status: "INATIVO", permissoes: "crm" });
    expect(await checarAcessoBpmPipeline("p1", 7, client)).toBe(false);
    db.usuarioPermissaoOverride.findMany.mockResolvedValue([{ modulo: "crm", acao: "REMOVE" }]);
    expect(await checarAcessoBpmPipeline("p1", 7, client)).toBe(false);
    expect((await checarAcessoBpmCard("c1", 7, "TI", "editarCard", client)).autorizado).toBe(false);
  });
  it("acesso padrão não edita terceiros e respeita a coluna", async () => {
    const db = criarClient(); const client = db as unknown as Client;
    expect((await checarAcessoBpmCard("c1", 7, "TI", "visualizar", client)).autorizado).toBe(true);
    expect((await checarAcessoBpmCard("c1", 7, "TI", "editarCard", client)).autorizado).toBe(false);
    const card = await db.bpmCard.findUnique();
    db.bpmCard.findUnique.mockResolvedValue({ ...card, etapa: { ...card.etapa, visibilidades: [{ perfil: "OPERACIONAL", podeVer: true, podeAgir: true }] } });
    expect((await checarAcessoBpmCard("c1", 7, "TI", "visualizar", client)).autorizado).toBe(false);
  });
  it("administração vale para todos os cards do funil e não promove a global", async () => {
    const db = criarClient([{ ...regra, nivel: "ADMINISTRATIVO" }]); const client = db as unknown as Client;
    for (const acao of ["visualizar", "editarCard", "moverEtapa", "adicionarParticipantes", "excluirCard"] as const) {
      expect(await checarAcessoBpmCard("c1", 7, null, acao, client)).toMatchObject({ autorizado: true, isAdminGlobal: false, isAdminPipeline: true, role: "ADMINISTRADOR", podeAgirEtapa: true, autoridadeMovimentoLivre: { tipo: "ADMIN_PIPELINE" } });
    }
    expect(await checarAcessoConfigPipeline(7, "configurarEtapas", client)).toBe(false);
    expect(db.bpmCardMembro.findUnique).not.toHaveBeenCalled();
  });
  it("administração ignora Boas-vindas e coluna, mas encaminhado só permite leitura e reposição", async () => {
    const db = criarClient([{ ...regra, nivel: "ADMINISTRATIVO" }]); const client = db as unknown as Client;
    const card = await db.bpmCard.findUnique();
    db.bpmCard.findUnique.mockResolvedValue({ ...card, pipelineId: PIPELINE_OPERACIONAL_ATIVO_ID, etapa: { nome: "Boas-vindas", ehFinal: false, visibilidades: [{ perfil: "OPERACIONAL", podeVer: false, podeAgir: false }] } });
    expect((await checarAcessoBpmCard("c1", 7, null, "editarCard", client)).autorizado).toBe(true);
    db.bpmCard.findUnique.mockResolvedValue({ ...card, status: "CONCLUIDO", etapa: { ...card.etapa, ehFinal: true } });
    expect(await checarAcessoBpmCard("c1", 7, null, "visualizar", client)).toMatchObject({ autorizado: true, podeAgirEtapa: false });
    expect((await checarAcessoBpmCard("c1", 7, null, "editarCard", client)).autorizado).toBe(false);
    expect((await checarAcessoBpmCard("c1", 7, null, "moverEtapa", client)).autorizado).toBe(true);
  });
  it.each(["Admin", "TI", "T.I", "CEO"])("preserva autoridade global %s", async (role) => {
    const db = criarClient([]); const client = db as unknown as Client;
    db.usuarios.findUnique.mockResolvedValue({ id: 7, role, status: "ATIVO", permissoes: "" });
    expect(await checarAcessoBpmCard("c1", 7, null, "moverEtapa", client)).toMatchObject({ autorizado: true, isAdminGlobal: true, autoridadeMovimentoLivre: { tipo: "ADMIN" } });
  });
});
