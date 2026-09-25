/** Plano somente leitura por padrão. --apply exige confirmação específica e backup Vault. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { validarGrafoAutomacao, gatilhoConfigSchema } = await import("../src/lib/bpm/automacoes/central-schemas");
const { grupoCondicaoSchema } = await import("../src/lib/bpm/regras/schemas");

const args = new Map(process.argv.slice(2).map((arg) => {
  const index = arg.indexOf("=");
  return index < 0 ? [arg, ""] : [arg.slice(0, index), arg.slice(index + 1)];
}));
const etapaChaves = ["confirmacao_pagamento", "emissao_nota_fiscal", "contratacao_finalizada"];
const campoChaves = {
  confirmado: "alpha.pagamento.confirmado", data: "alpha.data.do.pagamento",
  esperado: "alpha.valor.esperado", recebido: "alpha.valor.recebido",
  comprovante: "alpha.comprovante", comprovanteAntigo: "alpha.comprovante.pagamento",
  formaContratada: "alpha.forma.de.pagamento", statusFinanceiro: "alpha.status.financeiro",
  assinatura: "alpha.financeiro.status.contrato.assinatura", noExito: "alpha.pagamento.no.exito",
  liquido: "alpha.financeiro.valor.liquido.pagamento", bruto: "alpha.financeiro.valor.bruto.contrato",
  retencoes: "alpha.total.retencoes",
  vencimento: "alpha.vencimento",
} as const;
const novaForma = "alpha.financeiro.forma.pagamento.utilizada";
const novoStatus = "alpha.financeiro.status.contratacao";
const prefixo = "financeiro.pagamento.";
const opcoesForma = ["Pix", "Cartão de crédito", "Boleto", "Transferência bancária", "Manual"];
const opcoesStatus = ["Aguardando assinatura e pagamento", "Aguardando pagamento", "Aguardando assinatura", "Contratação concluída"];
const novasOpcoesFinanceiras = ["PAGAMENTO CONCLUÍDO", "Divergência financeira", "Pagamento vencido"];

const pipeline = await db.bpmPipeline.findFirst({ where: { chave: "financeiro", ativo: true }, select: { id: true, configVersion: true } });
if (!pipeline) throw new Error("Pipeline Financeiro indisponível");
const [etapas, campos, existentes, automacoesExistentes] = await Promise.all([
  db.bpmEtapa.findMany({ where: { pipelineId: pipeline.id, chave: { in: etapaChaves }, ativo: true }, select: { id: true, chave: true } }),
  db.bpmCampo.findMany({ where: { chave: { in: Object.values(campoChaves) }, ativo: true,
    OR: [{ pipelineId: pipeline.id }, { pipelinesAssociados: { some: { pipelineId: pipeline.id } } }],
  }, select: { id: true, chave: true, nome: true, tipo: true, opcoesJson: true } }),
  db.bpmCampo.findMany({ where: { chave: { in: [novaForma, novoStatus] } }, select: { id: true, chave: true } }),
  db.bpmAutomacao.findMany({ where: { pipelineId: pipeline.id, chave: { startsWith: prefixo } }, select: { chave: true } }),
]);
if (etapas.length !== etapaChaves.length || campos.length !== Object.values(campoChaves).length) throw new Error("Etapas ou campos fonte divergentes");
const etapaId = Object.fromEntries(etapas.map((etapa) => [etapa.chave, etapa.id]));
const ids = Object.fromEntries(campos.map((campo) => [Object.entries(campoChaves).find(([, chave]) => chave === campo.chave)?.[0], campo.id])) as Record<keyof typeof campoChaves, string>;
const formularios = await db.bpmEtapaFormulario.findMany({ where: { etapaId: { in: Object.values(etapaId) }, ativo: true }, include: { secoes: true } });
if (formularios.length !== etapaChaves.length || formularios.some((formulario) => !formulario.secoes.find((secao) => secao.chave === "fields"))) throw new Error("Formulário de Pagamento/NF/Concluídos incompleto");
const formularioPagamento = formularios.find((formulario) => formulario.etapaId === etapaId.confirmacao_pagamento)!;
const requisitosExistentes = await db.bpmRequisito.findMany({ where: { pipelineId: pipeline.id, chave: { startsWith: prefixo } }, select: { chave: true } });
const plano = {
  pipelineId: pipeline.id, configVersion: pipeline.configVersion, etapaId,
  formularios: Object.fromEntries(formularios.map((formulario) => [formulario.etapaId, formulario.versao])),
  novosCampos: [novaForma, novoStatus], camposExistentes: campos, existente: existentes, requisitosExistentes, automacoesExistentes,
  formulariosAfetados: ["Pagamento", "Nota Fiscal", "Concluídos"],
  politica: { comprovante: "Forma utilizada = Manual", cobranca: "Tarefa e alerta internos no vencimento; êxito registrado no serviço vinculado antes de cobrar", divergencia: "Bloquear saída até valores iguais", antecipacaoExito: "Card permanece em Pagamento" },
};
if (!args.has("--apply")) {
  console.log(JSON.stringify({ mode: "PLAN", ...plano }, null, 2));
  await db.$disconnect();
  process.exit(0);
}

if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")) throw new Error("Publicação exige Turso remoto explícito");
if (process.env.FINANCEIRO_PAGAMENTO_APROVADO !== "SIM_PUBLICAR_PAGAMENTO_FINANCEIRO") throw new Error("Confirmação específica ausente");
if (existentes.length || requisitosExistentes.length || automacoesExistentes.length) throw new Error("Configuração já existe; replaneje antes de repetir");
if (Number(args.get("--expected-config-version")) !== pipeline.configVersion || Number(args.get("--expected-form-version")) !== formularioPagamento.versao) throw new Error("Versões mudaram após o plano");
const adminId = Number(args.get("--admin-id"));
const admin = Number.isSafeInteger(adminId) ? await db.usuarios.findUnique({ where: { id: adminId }, select: { role: true, status: true } }) : null;
if (admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Administrador ativo obrigatório");
const manifestPath = args.get("--backup-manifest");
if (!manifestPath || !resolve(manifestPath).includes("/database-backups/pre-change/")) throw new Error("Backup pre-change obrigatório");
const manifestAbsoluto = resolve(manifestPath);
const manifest = JSON.parse(await readFile(manifestAbsoluto, "utf8"));
if (manifest.reason !== "financeiro-pagamento-config-checkpoint" || !Number.isFinite(Date.parse(manifest.generatedAt))
  || Date.now() - Date.parse(manifest.generatedAt) > 48 * 60 * 60 * 1000 || manifest.integrityCheck !== "ok"
  || manifest.foreignKeyViolations !== 0 || manifest.restoreTest !== "cópia local aberta e checada") throw new Error("Backup vencido ou sem verificação");
const backup = await readFile(manifest.backupPath);
if (backup.length !== manifest.sizeBytes || createHash("sha256").update(backup).digest("hex") !== manifest.sha256) throw new Error("Backup não confere com manifesto");
const snapshotPath = resolve(dirname(manifestAbsoluto), `financeiro-pagamento-before-${Date.now()}.json`);
const [camposAntes, configsAntes, componentesAntes, opcoesAntes] = await Promise.all([
  db.bpmCampo.findMany({ where: { id: { in: campos.map((campo) => campo.id) } } }),
  db.bpmCampoEtapaConfig.findMany({ where: { etapaId: { in: Object.values(etapaId) } } }),
  db.bpmFormularioComponente.findMany({ where: { secaoId: { in: formularios.flatMap((formulario) => formulario.secoes.map((secao) => secao.id)) } } }),
  db.bpmCampoOpcao.findMany({ where: { campoId: ids.statusFinanceiro } }),
]);
await writeFile(snapshotPath, `${JSON.stringify({ plano, formularios, camposAntes, configsAntes, componentesAntes, opcoesAntes }, null, 2)}\n`, { flag: "wx", mode: 0o600 });

type Ref = { fonte: string; campo: string };
const ref = (campo: string): Ref => ({ fonte: "campo_dinamico", campo });
const folha = (campo: Ref, operador: string, valor?: unknown, valorCampo?: Ref, tipoEsperado?: string) => ({
  tipo: "condicao", campo, operador, ...(valorCampo ? { valorCampo } : { valor }), ...(tipoEsperado ? { tipoEsperado } : {}),
});
const grupo = (...condicoes: unknown[]) => ({ operador: "AND", condicoes });
const ou = (...condicoes: unknown[]) => ({ operador: "OR", condicoes });
const preenchido = (campo: string) => folha(ref(campo), "preenchido");
const igual = (campo: string, valor: string) => grupo(preenchido(campo), folha(ref(campo), "igual", valor));
const assinatura = igual(ids.assinatura, "Assinado");
const confirmado = igual(ids.confirmado, "Sim");
const idsNovos: Record<string, string> = {};
let totalRequisitos = 0;
let totalAutomacoes = 0;
await db.$transaction(async (tx) => {
  const reservado = await tx.bpmPipeline.updateMany({
    where: { id: pipeline.id, configVersion: pipeline.configVersion },
    data: { configVersion: { increment: 1 } },
  });
  if (reservado.count !== 1) throw new Error("Configuração alterada simultaneamente; publicação cancelada");
for (const item of [
  { chave: novaForma, nome: "Forma de pagamento utilizada", tipo: "selecao", opcoes: opcoesForma, ordem: 4 },
  { chave: novoStatus, nome: "Status da contratação", tipo: "selecao", opcoes: opcoesStatus, ordem: 14 },
]) {
  const criado = await tx.bpmCampo.create({ data: { chave: item.chave, pipelineId: pipeline.id, nome: item.nome,
    tipo: item.tipo, opcoesJson: JSON.stringify(item.opcoes), escopo: "CARD", ativo: false,
    visivel: true, editavel: item.chave === novaForma, obrigatorio: false, ordem: item.ordem,
  } });
  idsNovos[item.chave] = criado.id;
  for (const [ordem, rotulo] of item.opcoes.entries()) await tx.bpmCampoOpcao.create({ data: {
    campoId: criado.id, chave: rotulo.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), rotulo, ordem,
  } });
}
const formaId = idsNovos[novaForma];
const statusGeralId = idsNovos[novoStatus];
const condicaoManual = grupo(confirmado, igual(formaId, "Manual"));
const camposPagamento = [
  { campoId: formaId, ordem: 4, editavel: true, condicao: confirmado },
  { campoId: ids.statusFinanceiro, ordem: 7, editavel: false },
  { campoId: statusGeralId, ordem: 8, editavel: false },
];
const camposEstado = [etapaId.emissao_nota_fiscal, etapaId.contratacao_finalizada];
for (const item of camposPagamento) {
  await tx.bpmCampoEtapaConfig.create({ data: {
    campoId: item.campoId, etapaId: etapaId.confirmacao_pagamento, visivel: true,
    editavel: item.editavel, somenteLeitura: !item.editavel, ordem: item.ordem,
    grupo: "Confirmação do pagamento", condicaoObrigatoriedadeJson: item.condicao ? JSON.stringify(item.condicao) : null,
  } });
  await tx.bpmFormularioComponente.create({ data: {
    secaoId: formularioPagamento.secoes.find((secao) => secao.chave === "fields")!.id,
    chave: `field:${item.campoId}`, tipo: "CAMPO", campoId: item.campoId, ordem: item.ordem,
  } });
}
for (const etapa of camposEstado) {
  const formulario = formularios.find((item) => item.etapaId === etapa)!;
  await tx.bpmCampoEtapaConfig.create({ data: {
    campoId: statusGeralId, etapaId: etapa, visivel: true, editavel: false, somenteLeitura: true, ordem: 95, grupo: "Estado da contratação",
  } });
  await tx.bpmFormularioComponente.create({ data: {
    secaoId: formulario.secoes.find((secao) => secao.chave === "fields")!.id,
    chave: `field:${statusGeralId}`, tipo: "CAMPO", campoId: statusGeralId, ordem: 95,
  } });
}
const configuracoes = [
  { campoId: ids.data, tipo: "data_hora", condicao: confirmado, valorPadrao: "{{agora.instante}}" },
  { campoId: ids.esperado, tipo: "moeda", condicao: confirmado, editavel: false },
  { campoId: ids.recebido, tipo: "moeda", condicao: confirmado },
  { campoId: ids.comprovante, tipo: "url_ou_arquivo", condicao: condicaoManual },
];
for (const item of configuracoes) {
  await tx.bpmCampo.update({ where: { id: item.campoId }, data: { tipo: item.tipo } });
  await tx.bpmCampoEtapaConfig.update({ where: { campoId_etapaId: { campoId: item.campoId, etapaId: etapaId.confirmacao_pagamento } }, data: {
    editavel: item.editavel !== false, somenteLeitura: item.editavel === false,
    condicaoObrigatoriedadeJson: JSON.stringify(item.condicao),
    ...(item.valorPadrao ? { valorPadrao: item.valorPadrao } : {}),
  } });
}
for (const item of [ids.formaContratada, ids.comprovanteAntigo]) {
  await tx.bpmCampoEtapaConfig.update({ where: { campoId_etapaId: { campoId: item, etapaId: etapaId.confirmacao_pagamento } }, data: { visivel: false } });
  await tx.bpmFormularioComponente.deleteMany({ where: { campoId: item, secao: { formularioId: formularioPagamento.id } } });
}
const campoStatus = campos.find((item) => item.id === ids.statusFinanceiro)!;
const rotulosStatus = JSON.parse(campoStatus.opcoesJson ?? "[]") as string[];
await tx.bpmCampo.update({ where: { id: ids.statusFinanceiro }, data: { opcoesJson: JSON.stringify([...new Set([...rotulosStatus, ...novasOpcoesFinanceiras])]) } });
for (const [indice, rotulo] of novasOpcoesFinanceiras.entries()) await tx.bpmCampoOpcao.create({ data: {
  campoId: ids.statusFinanceiro, chave: `pagamento-${indice + 1}`, rotulo, ordem: rotulosStatus.length + indice,
} });

const requisitos = [
  { chave: "data", alvoTipo: "CAMPO", campoId: ids.data, fase: "DURING_STAGE", condicao: confirmado, mensagem: "Data do pagamento" },
  { chave: "esperado", alvoTipo: "CAMPO", campoId: ids.esperado, fase: "DURING_STAGE", condicao: confirmado, mensagem: "Valor esperado" },
  { chave: "recebido", alvoTipo: "CAMPO", campoId: ids.recebido, fase: "DURING_STAGE", condicao: confirmado, mensagem: "Valor recebido" },
  { chave: "forma", alvoTipo: "CAMPO", campoId: formaId, fase: "DURING_STAGE", condicao: confirmado, mensagem: "Forma de pagamento utilizada" },
  { chave: "comprovante", alvoTipo: "CAMPO", campoId: ids.comprovante, fase: "DURING_STAGE", condicao: condicaoManual, mensagem: "Comprovante" },
  { chave: "esperado_negativo", alvoTipo: "REGRA", fase: "DURING_STAGE", condicao: grupo(preenchido(ids.esperado), folha(ref(ids.esperado), "menor", 0, undefined, "numero")), mensagem: "Valor esperado não pode ser negativo" },
  { chave: "recebido_negativo", alvoTipo: "REGRA", fase: "DURING_STAGE", condicao: grupo(preenchido(ids.recebido), folha(ref(ids.recebido), "menor", 0, undefined, "numero")), mensagem: "Valor recebido não pode ser negativo" },
  { chave: "pagamento_pendente", alvoTipo: "REGRA", fase: "EXIT_STAGE", condicao: ou(folha(ref(ids.confirmado), "vazio"), igual(ids.confirmado, "Não")), mensagem: "Confirme o pagamento antes de avançar para Nota Fiscal" },
  { chave: "divergencia", alvoTipo: "REGRA", fase: "EXIT_STAGE", condicao: grupo(confirmado, preenchido(ids.esperado), preenchido(ids.recebido), folha(ref(ids.recebido), "diferente", undefined, ref(ids.esperado), "numero")), mensagem: "Valor recebido diverge do valor esperado" },
  ...[ids.data, ids.esperado, ids.recebido, formaId].map((campoId, indice) => ({ chave: `saida_obrigatorio_${indice}`, alvoTipo: "CAMPO", campoId, fase: "EXIT_STAGE", condicao: confirmado, mensagem: "Complete os dados do pagamento antes de avançar" })),
  { chave: "saida_comprovante", alvoTipo: "CAMPO", campoId: ids.comprovante, fase: "EXIT_STAGE", condicao: condicaoManual, mensagem: "Anexe o comprovante da forma manual" },
  { chave: "saida_esperado_negativo", alvoTipo: "REGRA", fase: "EXIT_STAGE", condicao: grupo(preenchido(ids.esperado), folha(ref(ids.esperado), "menor", 0, undefined, "numero")), mensagem: "Valor esperado não pode ser negativo" },
  { chave: "saida_recebido_negativo", alvoTipo: "REGRA", fase: "EXIT_STAGE", condicao: grupo(preenchido(ids.recebido), folha(ref(ids.recebido), "menor", 0, undefined, "numero")), mensagem: "Valor recebido não pode ser negativo" },
  { chave: "saida_liquido_divergente", alvoTipo: "REGRA", fase: "EXIT_STAGE", condicao: grupo(preenchido(ids.liquido), preenchido(ids.esperado), folha(ref(ids.esperado), "diferente", undefined, ref(ids.liquido), "numero")), mensagem: "Valor esperado está desatualizado em relação ao valor líquido" },
  { chave: "saida_bruto_divergente", alvoTipo: "REGRA", fase: "EXIT_STAGE", condicao: grupo(folha(ref(ids.liquido), "vazio"), preenchido(ids.bruto), preenchido(ids.esperado), folha(ref(ids.esperado), "diferente", undefined, ref(ids.bruto), "numero")), mensagem: "Valor esperado está desatualizado em relação ao valor bruto" },
  { chave: "saida_liquido_retencoes", alvoTipo: "CAMPO", campoId: ids.liquido, fase: "EXIT_STAGE", condicao: grupo(preenchido(ids.retencoes), folha(ref(ids.retencoes), "maior", 0, undefined, "numero")), mensagem: "Calcule o valor líquido antes de avançar com retenções" },
  { chave: "saida_bruto_origem", alvoTipo: "CAMPO", campoId: ids.bruto, fase: "EXIT_STAGE", condicao: grupo(folha(ref(ids.liquido), "vazio")), mensagem: "Informe o valor bruto ou líquido de origem antes de avançar" },
];
for (const [ordem, item] of requisitos.entries()) {
  grupoCondicaoSchema.parse(item.condicao);
  await tx.bpmRequisito.create({ data: {
    chave: `${prefixo}${item.chave}`, pipelineId: pipeline.id, etapaId: etapaId.confirmacao_pagamento,
    alvoTipo: item.alvoTipo, campoId: item.campoId ?? null, fase: item.fase,
    condicaoJson: JSON.stringify(item.condicao), mensagem: item.mensagem, fonte: "ADMIN", ativo: false, ordem,
  } });
}
totalRequisitos = requisitos.length;

const noCondicao = (id: string, condicao: unknown, entaoId: string, senaoId: string) => ({ id, tipo: "CONDICAO", condicao, entaoId, senaoId });
const noAcao = (id: string, acaoTipo: string, parametros: Record<string, unknown>, proximoId: string) => ({ id, tipo: "ACAO", acaoTipo, parametros, proximoId });
const fim = { id: "fim", tipo: "FIM" };
const alterar = (id: string, campoId: string, valor: string, proximoId: string) => noAcao(id, "ALTERAR_CAMPO", { campoId, valor }, proximoId);
const grafoEsperado = { inicioId: "liquido", nos: [
  noCondicao("liquido", grupo(preenchido(ids.liquido)), "copiar_liquido", "bruto"),
  alterar("copiar_liquido", ids.esperado, `{{campo.${ids.liquido}}}`, "fim"),
  noCondicao("bruto", grupo(preenchido(ids.bruto), ou(folha(ref(ids.retencoes), "vazio"), grupo(preenchido(ids.retencoes), folha(ref(ids.retencoes), "igual", 0, undefined, "numero")))), "copiar_bruto", "fim"),
  alterar("copiar_bruto", ids.esperado, `{{campo.${ids.bruto}}}`, "fim"), fim,
] };
const valoresPresentes = grupo(preenchido(ids.esperado), preenchido(ids.recebido));
const valoresIguais = grupo(folha(ref(ids.recebido), "igual", undefined, ref(ids.esperado), "numero"));
const esperadoAtual = ou(
  grupo(preenchido(ids.liquido), folha(ref(ids.esperado), "igual", undefined, ref(ids.liquido), "numero")),
  grupo(folha(ref(ids.liquido), "vazio"), preenchido(ids.bruto),
    ou(folha(ref(ids.retencoes), "vazio"), grupo(preenchido(ids.retencoes), folha(ref(ids.retencoes), "igual", 0, undefined, "numero"))),
    folha(ref(ids.esperado), "igual", undefined, ref(ids.bruto), "numero")),
);
const statusVencido = igual(ids.statusFinanceiro, "Pagamento vencido");
const grafoStatus = { inicioId: "pago", nos: [
  noCondicao("pago", confirmado, "valores_presentes", "vencido"),
  noCondicao("valores_presentes", valoresPresentes, "valores_iguais", "divergente"),
  noCondicao("valores_iguais", valoresIguais, "fonte_atual", "divergente"),
  noCondicao("fonte_atual", esperadoAtual, "concluido", "divergente"),
  alterar("concluido", ids.statusFinanceiro, "PAGAMENTO CONCLUÍDO", "assinatura_pago"),
  noCondicao("assinatura_pago", assinatura, "geral_concluido", "geral_aguarda_assinatura"),
  alterar("geral_concluido", statusGeralId, "Contratação concluída", "tarefa_nf"),
  alterar("geral_aguarda_assinatura", statusGeralId, "Aguardando assinatura", "tarefa_nf"),
  noAcao("tarefa_nf", "CRIAR_TAREFA", { titulo: "Emitir Nota Fiscal – {{empresa.razaoSocial}}", tipo: "EMISSAO_NF", prioridade: "ALTA", naoDuplicarTipo: true }, "fim"),
  alterar("divergente", ids.statusFinanceiro, "Divergência financeira", "tarefa_divergencia"),
  noAcao("tarefa_divergencia", "CRIAR_TAREFA", { titulo: "Revisar divergência financeira – {{empresa.razaoSocial}}", tipo: "DIVERGENCIA_FINANCEIRA", prioridade: "ALTA", naoDuplicarPendenteTipo: true }, "assinatura_pendente"),
  noCondicao("vencido", statusVencido, "assinatura_pendente", "aguardando"),
  alterar("aguardando", ids.statusFinanceiro, "Aguardando pagamento", "assinatura_pendente"),
  noCondicao("assinatura_pendente", assinatura, "geral_aguarda_pagamento", "geral_aguarda_ambos"),
  alterar("geral_aguarda_pagamento", statusGeralId, "Aguardando pagamento", "fim"),
  alterar("geral_aguarda_ambos", statusGeralId, "Aguardando assinatura e pagamento", "fim"), fim,
] };
const exigivel = ou(folha(ref(ids.noExito), "vazio"), igual(ids.noExito, "Não"), grupo(igual(ids.noExito, "Sim"), folha({ fonte: "contratacao", campo: "dataExito" }, "preenchido")));
const condicaoCobranca = grupo(
  ou(folha(ref(ids.confirmado), "vazio"), igual(ids.confirmado, "Não")),
  preenchido(ids.vencimento),
  folha(ref(ids.vencimento), "menorOuIgual", undefined, { fonte: "agora", campo: "data" }, "data"),
  exigivel,
  ou(folha(ref(ids.statusFinanceiro), "vazio"), grupo(preenchido(ids.statusFinanceiro), folha(ref(ids.statusFinanceiro), "diferente", "Pagamento vencido"))),
);
const grafoCobranca = { inicioId: "marcar", nos: [
  alterar("marcar", ids.statusFinanceiro, "Pagamento vencido", "tarefa"),
  noAcao("tarefa", "CRIAR_TAREFA", { titulo: "Cobrar pagamento vencido – {{empresa.razaoSocial}}", tipo: "COBRANCA_FINANCEIRA", prioridade: "ALTA", naoDuplicarPendenteTipo: true }, "alerta"),
  noAcao("alerta", "CRIAR_ALERTA", { texto: "Pagamento vencido sem confirmação. Conferir vencimento e cobrar conforme a política interna." }, "fim"), fim,
] };
const automacoes = [
  { chave: "sincronizar_esperado_entrada", gatilhoTipo: "ENTRAR_COLUNA", config: { escopo: "ETAPAS", etapaId: etapaId.confirmacao_pagamento }, grafo: grafoEsperado },
  { chave: "sincronizar_esperado_liquido", gatilhoTipo: "CAMPO_ALTERADO", config: { escopo: "ETAPAS", etapaId: etapaId.confirmacao_pagamento, campoId: ids.liquido }, grafo: grafoEsperado },
  { chave: "sincronizar_esperado_bruto", gatilhoTipo: "CAMPO_ALTERADO", config: { escopo: "ETAPAS", etapaId: etapaId.confirmacao_pagamento, campoId: ids.bruto }, grafo: grafoEsperado },
  { chave: "sincronizar_esperado_retencoes", gatilhoTipo: "CAMPO_ALTERADO", config: { escopo: "ETAPAS", etapaId: etapaId.confirmacao_pagamento, campoId: ids.retencoes }, grafo: grafoEsperado },
  { chave: "recalcular_status_edicao", gatilhoTipo: "CARD_ATUALIZADO", config: { escopo: "ETAPAS", etapasIds: Object.values(etapaId) }, grafo: grafoStatus },
  { chave: "recalcular_status_esperado", gatilhoTipo: "CAMPO_ALTERADO", config: { escopo: "ETAPAS", etapasIds: Object.values(etapaId), campoId: ids.esperado }, grafo: grafoStatus },
  { chave: "recalcular_status_entrada", gatilhoTipo: "ENTRAR_COLUNA", config: { escopo: "ETAPAS", etapasIds: Object.values(etapaId) }, grafo: grafoStatus },
  { chave: "cobranca_vencimento", gatilhoTipo: "RECORRENCIA_ATINGIDA", config: { escopo: "ETAPAS", etapaId: etapaId.confirmacao_pagamento, recorrencia: { tipo: "DIARIA", hora: "09:00", ancora: "AGORA" } }, condicao: condicaoCobranca, grafo: grafoCobranca },
];
for (const item of automacoes) {
  gatilhoConfigSchema.parse(item.config);
  if (item.condicao) grupoCondicaoSchema.parse(item.condicao);
  validarGrafoAutomacao(item.grafo);
  const automacao = await tx.bpmAutomacao.create({ data: {
    chave: `${prefixo}${item.chave}`, nome: `Pagamento — ${item.chave.replaceAll("_", " ")}`,
    pipelineId: pipeline.id, etapaId: etapaId.confirmacao_pagamento, gatilhoTipo: item.gatilhoTipo,
    acaoTipo: "ALTERAR_CAMPO",
    parametrosJson: "{}", ativa: false, criadoPorId: adminId,
  } });
  await tx.bpmAutomacaoVersao.create({ data: {
    automacaoId: automacao.id, versao: 1, status: "ATIVA", gatilhoTipo: item.gatilhoTipo,
    gatilhoConfigJson: JSON.stringify(item.config), condicaoJson: item.condicao ? JSON.stringify(item.condicao) : null,
    grafoJson: JSON.stringify(item.grafo), timezone: "America/Sao_Paulo", criadoPorId: adminId, ativadaEm: new Date(),
  } });
}
totalAutomacoes = automacoes.length;
for (const id of Object.values(idsNovos)) await tx.bpmCampo.update({ where: { id }, data: { ativo: true } });
await tx.bpmRequisito.updateMany({ where: { pipelineId: pipeline.id, chave: { startsWith: prefixo } }, data: { ativo: true } });
await tx.bpmAutomacao.updateMany({ where: { pipelineId: pipeline.id, chave: { startsWith: prefixo } }, data: { ativa: true } });
for (const formulario of formularios) await tx.bpmEtapaFormulario.update({ where: { id: formulario.id }, data: { versao: { increment: 1 } } });
/* A versão foi reservada no início desta transação. */
}, { timeout: 120_000, maxWait: 10_000 });
console.log(JSON.stringify({ mode: "APPLIED", snapshotPath, novosCampos: idsNovos, requisitos: totalRequisitos, automacoes: totalAutomacoes }));
await db.$disconnect();
