import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma.ts");
const pipeline = await db.bpmPipeline.findFirst({ where: { chave: "financeiro" }, select: { id: true, configVersion: true } });
if (!pipeline) throw new Error("Pipeline Financeiro ausente");
const etapa = await db.bpmEtapa.findFirst({ where: { pipelineId: pipeline.id, chave: "solicitacao_contrato" }, select: { id: true } });
if (!etapa) throw new Error("Etapa Novo contrato ausente");
const formulario = await db.bpmEtapaFormulario.findUnique({
  where: { etapaId: etapa.id },
  include: { secoes: { include: { componentes: true }, orderBy: { ordem: "asc" } } },
});
if (!formulario) throw new Error("Formulário ausente");
const campos = await db.bpmCampo.findMany({
  where: { chave: { in: ["alpha.financeiro.valor.bruto.contrato", "alpha.regime.tributario.cliente", "alpha.status.financeiro"] } },
  select: {
    id: true, chave: true, ativo: true, opcoesJson: true,
    opcoes: { where: { ativo: true }, select: { rotulo: true } },
    mapeamentoDestino: { select: { campoOrigemId: true, modo: true, ativo: true } },
    etapaConfiguracoes: { where: { etapaId: etapa.id }, select: { visivel: true, editavel: true, obrigatorio: true } },
  },
});
const secoes = formulario.secoes.map((secao) => ({
  chave: secao.chave,
  titulo: secao.titulo,
  campos: secao.componentes.filter((componente) => componente.tipo === "CAMPO").length,
}));
const resultado = { versaoFormulario: formulario.versao, configVersion: pipeline.configVersion, secoes, campos };
console.log(JSON.stringify(resultado, null, 2));
if (formulario.versao < 5 || pipeline.configVersion < 9) throw new Error("Versão publicada abaixo da esperada");
if (secoes.filter((secao) => ["fields", "contratacao", "financeiro"].includes(secao.chave)).reduce((soma, secao) => soma + secao.campos, 0) !== 31) {
  throw new Error("Formulário não possui os 31 campos esperados");
}
const gross = campos.find((campo) => campo.chave === "alpha.financeiro.valor.bruto.contrato");
const regime = campos.find((campo) => campo.chave === "alpha.regime.tributario.cliente");
const status = campos.find((campo) => campo.chave === "alpha.status.financeiro");
if (!gross?.ativo || gross.mapeamentoDestino?.modo !== "COPIAR" || !gross.mapeamentoDestino.ativo) throw new Error("Mapeamento do valor ausente");
if (!regime?.ativo || regime.mapeamentoDestino?.modo !== "COPIAR" || !regime.mapeamentoDestino.ativo) throw new Error("Mapeamento do regime ausente");
if (!status?.opcoes.some((opcao) => opcao.rotulo === "Aguardando pagamento")) throw new Error("Status aguardando pagamento ausente");
await db.$disconnect();
