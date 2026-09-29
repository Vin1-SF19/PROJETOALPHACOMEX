/** Prévia read-only por padrão; --apply exige Vault e autorização específica. */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { config } from "dotenv";
import { verificarBackupTurso } from "./lib/verificar-backup-turso.mjs";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { validarGrafoAutomacao } = await import("../src/lib/bpm/automacoes/central-schemas");
const { FINANCIAL_FIELD_KEYS: F } = await import("../src/lib/bpm/pipeline-financeiro");
const { CHAVES_CAMPOS: C } = await import("../src/lib/bpm/financeiro-config.client");

const OPERACIONAL = "cmuih4tnh000409gm5z34jvss";
const RADAR = "cmuih48la000009gmzw3wwuzf";
const FINANCEIRO = "cmuih4i54000209gmmyqrg557";
const BOAS = "draft-stage-802def27-91ae-4231-b3f4-a251951c954a";
const HANDOFF = "financeiro_concluido_criar_card_operacional";
const VERSAO = 8;
const VITOR = 10;
const NOVOS = {
  RADAR_ATUAL: "alpha.operacional.radar.atual",
  DATA_ABERTURA: "alpha.operacional.empresa.data.abertura",
  CAPITAL: "alpha.operacional.capital.social.situacao",
  SEDE: "alpha.operacional.sede.status",
  PRODUTOS: "alpha.operacional.produtos.comercializados",
  FONTE: "alpha.operacional.fonte.negociacao",
  ANALISTA: "alpha.operacional.analista.responsavel",
  PRIMEIRA_REUNIAO: "alpha.operacional.primeira.reuniao.data.hora",
} as const;
const CAMPOS_ANALISE = [
  "embasamento", "radarPretendido", "radarAtual", "mesProtocolo", "regime",
  "dataAbertura", "capital", "faturamento", "sede", "armazenagem", "contas",
  "produtos", "atuacao", "tributos", "fonte", "vendedor", "contato",
] as const;
const CAMPOS_PROCESSO = ["analista", "primeiraReuniao"] as const;
type NomeCampo = typeof CAMPOS_ANALISE[number] | typeof CAMPOS_PROCESSO[number];
const aplicar = process.argv.includes("--apply");
const arg = (chave: string) => process.argv.slice(2).find((item) => item.startsWith(`--${chave}=`))?.slice(chave.length + 3);

try {
  const [pipeline, campos, handoff, vitor, admin] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: OPERACIONAL }, select: { nome: true, ativo: true,
      configVersion: true, etapas: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: {
        id: true, nome: true, ordem: true, formulario: { select: { id: true, versao: true,
          secoes: { select: { chave: true, componentes: { select: { campoId: true } } } } } },
      } } } }),
    db.bpmCampo.findMany({ where: { OR: [
      { pipelineId: { in: [RADAR, FINANCEIRO] } }, { chave: { in: Object.values(NOVOS) } },
    ] }, select: { id: true, nome: true, chave: true, pipelineId: true, ativo: true, tipo: true,
      escopo: true, editavel: true, somenteLeitura: true } }),
    db.bpmAutomacao.findUnique({ where: { pipelineId_chave: { pipelineId: FINANCEIRO, chave: HANDOFF } },
      select: { id: true, ativa: true, versoes: { where: { status: "ATIVA" }, select: {
        versao: true, gatilhoTipo: true, gatilhoConfigJson: true, condicaoJson: true,
        grafoJson: true, timezone: true,
      } } } }),
    db.usuarios.findUnique({ where: { id: VITOR }, select: { role: true, cargo: true, status: true } }),
    db.usuarios.findUnique({ where: { id: 1 }, select: { role: true, status: true } }),
  ]);
  const boas = pipeline?.etapas.find((item) => item.id === BOAS);
  const porChave = (chave: string, pipelineId?: string) => campos.find((campo) => campo.chave === chave
    && (!pipelineId || campo.pipelineId === pipelineId) && campo.ativo);
  const porNome = (nome: string, pipelineId: string) => campos.find((campo) => campo.nome === nome
    && campo.pipelineId === pipelineId && campo.ativo);
  const existentes: Record<Exclude<NomeCampo, "radarAtual" | "dataAbertura" | "capital" | "sede" | "produtos" | "fonte" | "analista" | "primeiraReuniao">, string | undefined> = {
    embasamento: porChave("alpha.radar.viabilidade.embasamento_processo", RADAR)?.id,
    radarPretendido: porNome("Radar pretendido", RADAR)?.id,
    mesProtocolo: porChave("alpha.radar.viabilidade.mes_protocolar", RADAR)?.id,
    regime: porChave(F.REGIME_CLIENTE, FINANCEIRO)?.id,
    faturamento: porChave("alpha.radar.viabilidade.faturamento_5_anos", RADAR)?.id,
    armazenagem: porChave("alpha.radar.viabilidade.armazenamento", RADAR)?.id,
    contas: porChave("alpha.radar.viabilidade.faturas_titularidade", RADAR)?.id,
    atuacao: porChave("alpha.radar.viabilidade.atuacao_empresa", RADAR)?.id,
    tributos: porChave("alpha.radar.viabilidade.tributos_semestre", RADAR)?.id,
    vendedor: porChave(C.VENDEDOR_RESPONSAVEL, FINANCEIRO)?.id,
    contato: porChave(C.CONTATO_RESPONSAVEL, FINANCEIRO)?.id,
  };
  const fonteRadar = porNome("Canal de origem", RADAR);
  const versaoHandoff = handoff?.versoes[0];
  const grafoHandoff = versaoHandoff ? validarGrafoAutomacao(JSON.parse(versaoHandoff.grafoJson)) : null;
  const noCriar = grafoHandoff?.nos.find((item) => item.tipo === "ACAO"
    && item.acaoTipo === "CRIAR_CARD_OUTRO_PIPELINE");
  const parametrosHandoff = noCriar?.tipo === "ACAO" ? noCriar.parametros : null;
  if (pipeline?.nome !== "Operacional" || !pipeline.ativo || pipeline.configVersion !== VERSAO
    || pipeline.etapas.length !== 13 || boas?.formulario?.versao !== 1
    || boas.formulario.secoes.flatMap((item) => item.componentes).length !== 20
    || pipeline.etapas.filter((item) => item.id !== BOAS).some((item) => item.formulario)
    || Object.values(existentes).some((id) => !id) || !fonteRadar
    || Object.values(NOVOS).some((chave) => campos.some((campo) => campo.chave === chave))
    || !handoff?.ativa || handoff.versoes.length !== 1 || versaoHandoff?.versao !== 1
    || versaoHandoff.gatilhoTipo !== "ENTRAR_COLUNA"
    || parametrosHandoff?.pipelineId !== OPERACIONAL || parametrosHandoff.etapaId !== BOAS
    || parametrosHandoff.responsavelId !== undefined
    || vitor?.role !== "OPERACIONAL" || vitor.status !== "ATIVO"
    || admin?.role !== "Admin" || admin.status !== "ATIVO") {
    throw new Error("Pré-condições do Operacional divergentes; refazer inventário antes de publicar.");
  }
  if (!grafoHandoff || !noCriar || !versaoHandoff || !handoff) {
    throw new Error("Grafo de handoff indisponível.");
  }
  const plano = { mode: aplicar ? "apply" : "preview", pipelineId: OPERACIONAL,
    versaoDe: VERSAO, versaoPara: VERSAO + 1, etapas: pipeline.etapas.length,
    camposAnalise: CAMPOS_ANALISE.length, camposProcesso: CAMPOS_PROCESSO.length,
    camposNovos: Object.values(NOVOS), boasFormularioDe: 1, boasFormularioPara: 2,
    fontesExistentes: campos.filter((campo) => Object.values(existentes).includes(campo.id))
      .map((campo) => ({ nome: campo.nome, editavel: campo.editavel, somenteLeitura: campo.somenteLeitura })),
    componentesBoasDe: 20, componentesBoasPara: 37,
    formulariosNovos: 12, handoffVersaoDe: 1, handoffVersaoPara: 2,
    responsavelInicialId: VITOR, cardsExistentesAlterados: false };
  if (!aplicar) {
    console.log(JSON.stringify(plano, null, 2));
  } else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")
      || arg("approval") !== "AUTORIZO_BOAS_VINDAS_OPERACIONAL"
      || Number(arg("expect-version")) !== VERSAO || Number(arg("admin-id")) !== 1) {
      throw new Error("Ambiente, autorização ou versão inválidos.");
    }
    const backup = arg("backup"), manifest = arg("manifest");
    if (!backup || !manifest) throw new Error("Backup Vault dedicado obrigatório.");
    const m = JSON.parse(readFileSync(manifest, "utf8")), b = statSync(backup), criado = Date.parse(m.generatedAt);
    if (!backup.includes("database-backups/pre-change/") || m.reason !== "boas-vindas-operacional-v9"
      || !Number.isFinite(criado) || criado > Date.now() || Date.now() - criado > 48 * 3600_000
      || b.size < 1_000_000 || b.size !== m.sizeBytes
      || createHash("sha256").update(readFileSync(backup)).digest("hex") !== m.sha256) {
      throw new Error("Backup dedicado, completo, íntegro e recente obrigatório.");
    }
    await verificarBackupTurso(backup, manifest);
    await db.$transaction(async (tx) => {
      const reservado = await tx.bpmPipeline.updateMany({ where: { id: OPERACIONAL,
        configVersion: VERSAO }, data: { configVersion: { increment: 1 } } });
      if (reservado.count !== 1) throw new Error("Versão do Operacional mudou durante a publicação.");
      const novos = [
        { nomeCampo: "radarAtual", chave: NOVOS.RADAR_ATUAL, nome: "Radar atual", tipo: "texto", escopo: "CARD" },
        { nomeCampo: "dataAbertura", chave: NOVOS.DATA_ABERTURA, nome: "Data de abertura da empresa", tipo: "data", escopo: "GLOBAL", fonteEntidade: "CLIENTE", fonteAtributo: "dataConstituicao" },
        { nomeCampo: "capital", chave: NOVOS.CAPITAL, nome: "Situação do capital social", tipo: "texto_longo", escopo: "CARD" },
        { nomeCampo: "sede", chave: NOVOS.SEDE, nome: "Status da sede", tipo: "texto", escopo: "CARD" },
        { nomeCampo: "produtos", chave: NOVOS.PRODUTOS, nome: "Produtos comercializados", tipo: "texto_longo", escopo: "CARD" },
        { nomeCampo: "fonte", chave: NOVOS.FONTE, nome: "Fonte", tipo: "texto", escopo: "CARD" },
        { nomeCampo: "analista", chave: NOVOS.ANALISTA, nome: "Responsável pelo processo", tipo: "usuario", escopo: "GLOBAL", fonteEntidade: "CARD", fonteAtributo: "responsavelId" },
        { nomeCampo: "primeiraReuniao", chave: NOVOS.PRIMEIRA_REUNIAO, nome: "Data e hora da primeira reunião", tipo: "data_hora", escopo: "GLOBAL", fonteEntidade: "CARD", fonteAtributo: "dataReuniao" },
      ] as const;
      const ids = new Map<NomeCampo, string>(Object.entries(existentes) as Array<[NomeCampo, string]>);
      for (const [ordem, spec] of novos.entries()) {
        const campo = await tx.bpmCampo.create({ data: { pipelineId: OPERACIONAL,
          chave: spec.chave, nome: spec.nome, tipo: spec.tipo, escopo: spec.escopo,
          fonteEntidade: "fonteEntidade" in spec ? spec.fonteEntidade : null,
          fonteAtributo: "fonteAtributo" in spec ? spec.fonteAtributo : null,
          editavel: !["analista", "primeiraReuniao"].includes(spec.nomeCampo),
          somenteLeitura: ["analista", "primeiraReuniao"].includes(spec.nomeCampo),
          ordem: 400 + ordem, ativo: true, visivel: true,
        } });
        ids.set(spec.nomeCampo, campo.id);
      }
      await tx.bpmCampoMapeamento.create({ data: { campoOrigemId: fonteRadar.id,
        campoDestinoId: ids.get("fonte")!, modo: "COPIAR", ativo: true } });
      const nomes: NomeCampo[] = [...CAMPOS_ANALISE, ...CAMPOS_PROCESSO];
      for (const etapa of pipeline.etapas) {
        const formulario = etapa.formulario ?? await tx.bpmEtapaFormulario.create({ data: {
          etapaId: etapa.id, versao: 1, ativo: true,
        } });
        const secao = await tx.bpmFormularioSecao.create({ data: {
          formularioId: formulario.id, chave: "dados_analise_operacional",
          titulo: "Dados da negociação e início do atendimento", ordem: etapa.id === BOAS ? 1 : 0,
        } });
        const existentesNoFormulario = new Set(etapa.formulario?.secoes.flatMap((item) =>
          item.componentes.map((componente) => componente.campoId)) ?? []);
        for (const [ordem, nomeCampo] of nomes.entries()) {
          const campoId = ids.get(nomeCampo)!;
          await tx.bpmCampoPipeline.upsert({ where: { campoId_pipelineId: { campoId, pipelineId: OPERACIONAL } },
            create: { campoId, pipelineId: OPERACIONAL }, update: {} });
          await tx.bpmCampoEtapaConfig.upsert({ where: { campoId_etapaId: { campoId, etapaId: etapa.id } },
            create: { campoId, etapaId: etapa.id, visivel: true,
              editavel: nomeCampo !== "analista" && nomeCampo !== "primeiraReuniao",
              somenteLeitura: nomeCampo === "analista" || nomeCampo === "primeiraReuniao",
              obrigatorioSaida: etapa.id === BOAS && CAMPOS_ANALISE.includes(nomeCampo as typeof CAMPOS_ANALISE[number]),
              ordem: 100 + ordem, grupo: "Dados da negociação e início do atendimento" },
            update: etapa.id === BOAS && CAMPOS_ANALISE.includes(nomeCampo as typeof CAMPOS_ANALISE[number])
              ? { obrigatorioSaida: true, visivel: true, editavel: true, somenteLeitura: false } : {},
          });
          if (!existentesNoFormulario.has(campoId)) await tx.bpmFormularioComponente.create({ data: {
            secaoId: secao.id, chave: `campo:${campoId}`, tipo: "CAMPO", campoId, ordem,
          } });
        }
        if (etapa.id === BOAS) await tx.bpmEtapaFormulario.update({ where: { id: formulario.id },
          data: { versao: { increment: 1 } } });
      }
      const grafoAtualizado = validarGrafoAutomacao({ ...grafoHandoff,
        nos: grafoHandoff.nos.map((no) => no.id === noCriar.id && no.tipo === "ACAO"
          ? { ...no, parametros: { ...no.parametros, responsavelId: VITOR } } : no),
      });
      await tx.bpmAutomacaoVersao.updateMany({ where: { automacaoId: handoff.id, status: "ATIVA" },
        data: { status: "ARQUIVADA", arquivadaEm: new Date() } });
      await tx.bpmAutomacaoVersao.create({ data: { automacaoId: handoff.id, versao: 2,
        status: "ATIVA", gatilhoTipo: versaoHandoff.gatilhoTipo,
        gatilhoConfigJson: versaoHandoff.gatilhoConfigJson,
        condicaoJson: versaoHandoff.condicaoJson,
        grafoJson: JSON.stringify(grafoAtualizado), timezone: versaoHandoff.timezone,
        criadoPorId: 1, ativadaEm: new Date(),
      } });
    }, { maxWait: 20_000, timeout: 180_000 });
    console.log(JSON.stringify({ ...plano, sucesso: true }));
  }
} finally {
  await db.$disconnect();
}
