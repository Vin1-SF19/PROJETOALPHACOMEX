import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checarAcessoModuloBpm } from "@/lib/bpm/ownership";

const source = (relative: string) => readFileSync(resolve(relative), "utf8");

describe("CRM/BPM authorization regression guards", () => {
  it("denies an authenticated inactive user or one without effective CRM", async () => {
    const client = (usuario: { status: string; role: string; permissoes: string | null }) => ({
      usuarios: { findUnique: async () => ({ id: 7, ...usuario }) },
      setorPermissao: { findMany: async () => [] },
      usuarioPermissaoOverride: { findMany: async () => [] },
      bpmPipeline: {},
      bpmCardMembro: {},
    });

    await expect(checarAcessoModuloBpm(7, client({
      status: "ATIVO", role: "COMERCIAL", permissoes: "metas",
    }) as never)).resolves.toBe(false);
    await expect(checarAcessoModuloBpm(7, client({
      status: "INATIVO", role: "COMERCIAL", permissoes: "crm",
    }) as never)).resolves.toBe(false);
  });

  it("requires effective CRM and active-user resolution for global read surfaces", () => {
    const dashboard = source("src/actions/bpm/Dashboard.ts");
    const empresas = source("src/actions/bpm/Empresas.ts");
    const tarefas = source("src/actions/bpm/Tarefas.ts");
    const pipelines = source("src/actions/bpm/Pipelines.ts");

    expect(dashboard).toContain("await exigirAcessoModuloBpm(userId)");
    expect(empresas).toContain("await exigirAcessoModuloBpm(userId)");
    expect(tarefas).toContain("await exigirAcessoModuloBpm(userId)");
    expect(pipelines).toContain("await exigirAcessoModuloBpm(Number(session.user.id))");
    expect(empresas).toContain("cardIds.length === 0");
    expect(tarefas).toContain("await exigirAcessoBpmPipeline(pipelineId, userId)");
  });

  it("prevents target-card and cross-history relationship bypasses", () => {
    const vinculos = source("src/actions/bpm/Vinculos.ts");
    const cards = source("src/actions/bpm/Cards.ts");

    expect(vinculos).toContain("exigirAcessoBpmCard(cardDestinoId");
    expect(vinculos).toContain("exigirAcessoBpmCard(cardOrigemId");
    expect(vinculos).toContain("cardIdsVisiveis");
    expect(cards).toContain("podeVerVinculado");
    expect(cards).toContain("membros: { some: { userId } }");
  });

  it("does not expose the history writer as a Server Action", () => {
    const cards = source("src/actions/bpm/Cards.ts");
    const historico = source("src/lib/bpm/historico-server.ts");

    expect(cards).not.toContain("export async function registrarHistoricoCard");
    expect(historico).toContain('import "server-only"');
    expect(historico).toContain("export async function registrarHistoricoCard");
  });

  it("rechecks authorization in transactional and meeting paths", () => {
    const meet = source("src/actions/bpm/GoogleMeet.ts");
    const tarefas = source("src/actions/bpm/Tarefas.ts");
    const anexos = source("src/actions/bpm/Anexos.ts");
    const followUp = source("src/actions/bpm/FollowUp.ts");

    expect(meet).toContain("await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, \"editarCard\")");
    expect(meet).toContain('"editarCard", tx');
    expect(meet).toContain("ERRO_ETAPA_REUNIAO");
    expect(meet).toContain("cardAntesDeCriarEvento");
    expect(meet).toContain("cardAntesDeReagendar");
    expect(meet).toContain("cardAntesDePersistir");
    expect(meet).toContain("tx.bpmCard.updateMany");
    expect(tarefas).toContain('"criarTarefa", tx');
    expect(anexos).toContain('"enviarArquivo", tx');
    expect(followUp).toContain('"editarCard", tx');
  });

  it("keeps restricted attachment storage and pipeline event metadata behind authorization", () => {
    const upload = source("src/app/api/bpm/upload/route.ts");
    const anexos = source("src/actions/bpm/Anexos.ts");
    const download = source("src/app/api/bpm/anexos/[anexoId]/route.ts");
    const historico = source("src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx");
    const cards = source("src/actions/bpm/Cards.ts");
    const pusher = source("src/app/api/pusher/auth/route.ts");

    expect(upload).toContain('access: "private"');
    expect(upload).toContain("criarReciboUploadAnexoBpm");
    expect(upload).toContain("recibosAnexoBpmConfigurados");
    expect(upload).not.toContain("url: blob.url");
    expect(anexos).toContain("validarReciboUploadAnexoBpm");
    expect(anexos).toContain("bpmCardAnexo.findFirst");
    expect(anexos).toContain("criado: false");
    expect(anexos).not.toContain("const { cardId, url");
    expect(download).toContain('"visualizar"');
    expect(download).toContain("get(pathnamePrivado ?? urlLegada!");
    expect(historico).toContain("/api/bpm/anexos/${a.id}");
    expect(historico).not.toContain("href={a.url}");
    expect(cards).toContain("url: `/api/bpm/anexos/${anexo.id}`");
    expect(pusher).toContain("checarAcessoRealtimeBpmPipeline");
  });

  it("does not list pipeline-specific task presets without an authorized pipeline context", () => {
    const tarefas = source("src/actions/bpm/Tarefas.ts");
    expect(tarefas).toContain("where: pipelineId ? { OR: [{ pipelineId }, { pipelineId: null }] } : { pipelineId: null }");
  });

  it("derives dashboard card counts from the caller-visible card set", () => {
    const dashboard = source("src/actions/bpm/Dashboard.ts");
    expect(dashboard).not.toContain('_count: { select: { cards: true } }');
    expect(dashboard).toContain("pipelinesComContagemVisivel");
    expect(dashboard).toContain("contagemVisivel");
  });

  it("resolves configuration permission from the database, never session role", () => {
    const ownership = source("src/lib/bpm/ownership.ts");
    const campos = source("src/actions/bpm/Campos.ts");
    const etapas = source("src/actions/bpm/Etapas.ts");

    expect(ownership).toContain("carregarUsuarioEPermissoesBpm(userId, client)");
    expect(campos).toContain("await exigirAcessoConfigPipeline(userId");
    expect(etapas).toContain("await exigirAcessoConfigPipeline(userId");
    expect(campos).not.toContain("exigirAcessoConfigPipeline(session.user.role");
  });
});
