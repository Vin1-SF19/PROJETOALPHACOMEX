/** Inventário somente leitura do Operacional ativo e das fontes da negociação. */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const OPERACIONAL = "cmuih4tnh000409gm5z34jvss";
const ALVOS = [
  "Embasamento do processo", "Radar pretendido", "Radar atual", "Mês de protocolo",
  "Regime tributário", "Data de abertura da empresa", "Situação do capital social",
  "Faturamento dos últimos 5 anos", "Status da sede", "Armazenagem", "Contas/faturas",
  "Produtos comercializados", "Atuação da empresa", "Tributos pagos nos últimos 6 meses",
  "Fonte", "Vendedor(a)", "Contato responsável/representante", "Data e hora da primeira reunião",
];
const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

try {
  const [pipeline, campos, configuracoes, automacoes, usuariosVitor, analistas] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: OPERACIONAL }, select: {
      id: true, nome: true, chave: true, ativo: true, configVersion: true,
      setores: { select: { setor: { select: { nome: true } } } },
      etapas: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: {
        id: true, chave: true, nome: true, ordem: true, ehInicial: true, ehFinal: true,
        visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } },
        _count: { select: { cards: true } },
        formulario: { select: { id: true, versao: true, ativo: true,
          secoes: { select: { chave: true, componentes: { select: { campoId: true } } } } } },
      } },
    } }),
    db.bpmCampo.findMany({ where: { ativo: true }, select: {
      id: true, chave: true, nome: true, tipo: true, escopo: true, pipelineId: true,
      editavel: true, somenteLeitura: true,
      fonteEntidade: true, fonteAtributo: true,
      pipelinesAssociados: { select: { pipelineId: true } },
    } }),
    db.bpmCampoEtapaConfig.findMany({ where: { etapa: { pipelineId: OPERACIONAL } }, select: {
      campoId: true, etapaId: true, visivel: true, obrigatorioEntrada: true, editavel: true,
    } }),
    db.bpmAutomacao.findMany({ where: { pipelineId: OPERACIONAL, ativa: true }, select: {
      chave: true, nome: true, gatilhoTipo: true, acaoTipo: true,
    } }),
    db.usuarios.findMany({ where: { OR: [
      { nome: { contains: "Vitor" } }, { nome: { contains: "Vítor" } },
      { usuario: { contains: "vitor" } },
    ] }, select: { id: true, nome: true, role: true, cargo: true, status: true } }),
    db.usuarios.findMany({ where: { status: "ATIVO", OR: [
      { cargo: { contains: "Analista" } }, { role: "OPERACIONAL" },
    ] }, select: { id: true, role: true, cargo: true } }),
  ]);
  if (!pipeline?.ativo) throw new Error("Pipeline Operacional ativo não encontrado.");
  const associacoes = new Map(configuracoes.map((item) => [`${item.campoId}:${item.etapaId}`, item]));
  const porAlvo = ALVOS.map((alvo) => ({ alvo, candidatos: campos.filter((campo) =>
    normalizar(campo.nome) === normalizar(alvo)
    || (alvo === "Vendedor(a)" && /vendedor/i.test(campo.nome))
    || (alvo === "Contato responsável/representante" && /contato|respons[aá]vel/i.test(campo.nome))
    || (alvo === "Data e hora da primeira reunião" && /reuni[aã]o|data.*hora/i.test(campo.nome)),
  ).map((campo) => ({ id: campo.id, chave: campo.chave, nome: campo.nome, tipo: campo.tipo,
    escopo: campo.escopo, pipelineId: campo.pipelineId,
    editavel: campo.editavel, somenteLeitura: campo.somenteLeitura,
    fonte: campo.fonteEntidade && `${campo.fonteEntidade}.${campo.fonteAtributo}`,
    associadoOperacional: campo.pipelineId === OPERACIONAL
      || campo.pipelinesAssociados.some((item) => item.pipelineId === OPERACIONAL),
    etapas: pipeline.etapas.flatMap((etapa) => {
      const config = associacoes.get(`${campo.id}:${etapa.id}`);
      return config ? [{ chave: etapa.chave, visivel: config.visivel,
        entrada: config.obrigatorioEntrada, editavel: config.editavel }] : [];
    }),
  })) }));
  console.log(JSON.stringify({
    pipeline: { id: pipeline.id, nome: pipeline.nome, chave: pipeline.chave,
      versao: pipeline.configVersion, setores: pipeline.setores.map((item) => item.setor.nome) },
    etapas: pipeline.etapas.map((etapa) => ({ id: etapa.id, chave: etapa.chave,
      nome: etapa.nome, ordem: etapa.ordem, inicial: etapa.ehInicial, final: etapa.ehFinal,
      cards: etapa._count.cards, formulario: etapa.formulario?.versao ?? null,
      visibilidades: etapa.visibilidades,
      componentes: etapa.formulario?.secoes.flatMap((secao) => secao.componentes).length ?? 0,
      camposFormulario: etapa.formulario?.secoes.flatMap((secao) => secao.componentes)
        .map((componente) => campos.find((campo) => campo.id === componente.campoId))
        .filter((campo): campo is NonNullable<typeof campo> => Boolean(campo))
        .map((campo) => ({ chave: campo.chave, nome: campo.nome, tipo: campo.tipo })) ?? [] })),
    camposAlvo: porAlvo,
    camposRadar: campos.filter((campo) => campo.pipelineId === "cmuih48la000009gmzw3wwuzf")
      .map((campo) => ({ chave: campo.chave, nome: campo.nome, tipo: campo.tipo,
        escopo: campo.escopo, fonte: campo.fonteEntidade && `${campo.fonteEntidade}.${campo.fonteAtributo}` })),
    usuariosVitor,
    analistasPossiveis: analistas,
    automacoes,
  }, null, 2));
} finally {
  await db.$disconnect();
}
