/** Prévia por padrão; publicação no Turso somente após checkpoint Vault específico. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { FINANCIAL_FIELD_KEYS: K } = await import("../src/lib/bpm/pipeline-financeiro");
const { CONTRATO_PADRAO_ID } = await import("../src/lib/gerador-documentos/contrato-padrao-id");
const { validarGrafoAutomacao, gatilhoConfigSchema } = await import("../src/lib/bpm/automacoes/central-schemas");
const { grupoCondicaoSchema } = await import("../src/lib/bpm/regras/schemas");

const PIPELINE = "cmuih4i54000209gmmyqrg557";
const NOVO = "draft-stage-92d707af-9b90-4f71-a9be-58ec7fbe98f8";
const ELABORACAO = "draft-stage-945a9c43-8226-48bd-b3c6-65dd5fa79396";
const CHAVES = {
  elaborado: "alpha.contrato.elaborado",
  dataElaboracao: "alpha.data.de.elaboracao",
  enviado: "alpha.contrato.enviado.para.assinatura",
  dataEnvio: "alpha.data.do.envio",
  contrato: "alpha.link.arquivo.do.contrato",
  status: "alpha.financeiro.status.contrato.assinatura",
} as const;
const specs = [
  { chave: CHAVES.elaborado, nome: "Contrato elaborado", tipo: "selecao", opcoes: ["Sim", "Não"] },
  { chave: CHAVES.dataElaboracao, nome: "Data de elaboração", tipo: "data" },
  { chave: CHAVES.enviado, nome: "Contrato enviado para assinatura", tipo: "selecao", opcoes: ["Sim", "Não"] },
  { chave: CHAVES.dataEnvio, nome: "Data do envio", tipo: "data_hora" },
  { chave: CHAVES.contrato, nome: "Link/arquivo do contrato", tipo: "url_ou_arquivo" },
  { chave: CHAVES.status, nome: "Status da assinatura", tipo: "selecao", opcoes: ["Aguardando assinatura"], calculado: true },
] as const;
const fonteObrigatoria = [K.CNPJ, K.RAZAO_SOCIAL, K.RUA, K.NUMERO, K.BAIRRO, K.CEP,
  K.MUNICIPIO, K.ESTADO, K.EMAIL, K.REGIME_CLIENTE, K.SERVICO, K.VALOR_BRUTO,
  K.FORMA_PAGAMENTO, K.CONDICAO] as string[];
const fonteAlerta = [...fonteObrigatoria, K.COMPLEMENTO];
const arg = (key: string) => process.argv.slice(2).find((item) => item.startsWith(`--${key}=`))?.slice(key.length + 3);
const aplicar = process.argv.includes("--apply");
const cond = (id: string, valor: string) => ({ operador: "AND", condicoes: [
  { tipo: "condicao", campo: { fonte: "campo_dinamico", campo: id }, operador: "igual", valor },
] });
const vazioOuNao = (id: string) => ({ operador: "OR", condicoes: [
  { tipo: "condicao", campo: { fonte: "campo_dinamico", campo: id }, operador: "vazio" },
  { tipo: "condicao", campo: { fonte: "campo_dinamico", campo: id }, operador: "igual", valor: "Não" },
] });
function grafo(acoes: Array<{ tipo: string; parametros: Record<string, unknown> }>) {
  return { inicioId: "acao_1", nos: [
    ...acoes.map((acao, i) => ({ id: `acao_${i + 1}`, tipo: "ACAO", acaoTipo: acao.tipo,
      parametros: acao.parametros, proximoId: i + 1 < acoes.length ? `acao_${i + 2}` : "fim" })),
    { id: "fim", tipo: "FIM" },
  ] };
}

try {
  const [pipeline, novo, etapa, campos, template, contratada, cards] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: PIPELINE }, select: { chave: true, configVersion: true } }),
    db.bpmEtapa.findUnique({ where: { id: NOVO }, select: { chave: true, ativo: true, formulario: { select: { id: true, versao: true } } } }),
    db.bpmEtapa.findUnique({ where: { id: ELABORACAO }, select: { chave: true, ativo: true, formulario: { select: { id: true } } } }),
    db.bpmCampo.findMany({ where: { chave: { in: [...fonteAlerta, ...specs.map((s) => s.chave)] } },
      select: { id: true, chave: true, nome: true, pipelineId: true, ativo: true } }),
    db.documentoTemplate.findUnique({ where: { id: CONTRATO_PADRAO_ID }, select: { id: true, status: true } }),
    db.empresaContratada.findFirst({ where: { razaoSocial: "ALPHA - COMEX, SERVICOS ADMINISTRATIVOS ESPECIALIZADOS E COWORKING LTDA", status: "ATIVO" }, select: { id: true } }),
    db.bpmCard.count({ where: { etapaId: ELABORACAO } }),
  ]);
  if (pipeline?.chave !== "financeiro" || novo?.chave !== "solicitacao_contrato" || !novo.ativo || !novo.formulario
    || etapa?.chave !== "elaboracao_contrato" || !etapa.ativo || etapa.formulario) throw new Error("Etapa ativa ou formulário mudou; refaça o plano.");
  const fonte = new Map(campos.filter((campo) => campo.pipelineId === PIPELINE && campo.ativo && campo.chave).map((campo) => [campo.chave!, campo]));
  if (fonteAlerta.some((chave) => !fonte.has(chave)) || specs.some((spec) => campos.some((campo) => campo.chave === spec.chave))) {
    throw new Error("Campos fonte divergentes ou campos de elaboração já publicados.");
  }
  const [configs, componentes, autosExistentes, reqExistentes] = await Promise.all([
    db.bpmCampoEtapaConfig.findMany({ where: { etapaId: NOVO, campoId: { in: fonteObrigatoria.map((chave) => fonte.get(chave)!.id) } }, select: { campoId: true, visivel: true, obrigatorioSaida: true } }),
    db.bpmFormularioComponente.findMany({ where: { campoId: { in: fonteAlerta.map((chave) => fonte.get(chave)!.id) }, secao: { formularioId: novo.formulario.id } }, select: { campoId: true } }),
    db.bpmAutomacao.count({ where: { pipelineId: PIPELINE, chave: { startsWith: "financeiro.elaboracao.ativa." } } }),
    db.bpmRequisito.count({ where: { pipelineId: PIPELINE, chave: { startsWith: "financeiro.elaboracao.ativa." } } }),
  ]);
  if (configs.length !== fonteObrigatoria.length || configs.some((item) => !item.visivel || !item.obrigatorioSaida)
    || new Set(componentes.map((item) => item.campoId)).size !== fonteAlerta.length || autosExistentes || reqExistentes) {
    throw new Error("Fonte validada ou configuração de Elaboração divergiu; refaça o plano.");
  }
  if (template?.status !== "ATIVO" || !contratada) throw new Error("Modelo padrão ou contratada do Gerador indisponível.");
  const plano = { financeiroVersion: pipeline.configVersion, etapaId: ELABORACAO, formNovoVersion: novo.formulario.versao,
    fields: specs.map(({ chave, nome, tipo }) => ({ chave, nome, tipo })), sourceRequirements: fonteObrigatoria.length,
    alerts: fonteAlerta.length, automations: 3 + fonteAlerta.length, cardsNaEtapa: cards,
    gerador: { templateId: template.id, contratadaId: contratada.id, condicao: "Serviço contratado contém Radar" },
  };
  if (!aplicar) { console.log(JSON.stringify({ mode: "preview", ...plano }, null, 2)); }
  else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://") || arg("approval") !== "AUTORIZO_ELABORACAO_FINANCEIRO_ATIVO") throw new Error("Autorização específica do Turso ausente.");
    if (Number(arg("expect-financeiro")) !== pipeline.configVersion || Number(arg("admin-id")) !== 1) throw new Error("Versão ou administrador divergente.");
    const backup = arg("backup"), manifest = arg("manifest");
    if (!backup || !manifest) throw new Error("Backup dedicado obrigatório.");
    const m = JSON.parse(readFileSync(manifest, "utf8")), b = statSync(backup), criado = Date.parse(m.generatedAt);
    if (!backup.includes("database-backups/pre-change/") || !String(m.reason).includes("elaboracao-contrato-financeiro-ativo")
      || !Number.isFinite(criado) || criado > Date.now() || Date.now() - criado > 48 * 3600_000
      || b.size < 1_000_000 || b.size !== m.sizeBytes || createHash("sha256").update(readFileSync(backup)).digest("hex") !== m.sha256) {
      throw new Error("Backup dedicado, íntegro e recente obrigatório.");
    }
    execFileSync("node", ["scripts/verify-turso-backup.mjs", backup, manifest], { stdio: "pipe" });
    const admin = await db.usuarios.findUnique({ where: { id: 1 }, select: { role: true, status: true } });
    if (admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Administrador inválido.");
    await db.$transaction(async (tx) => {
      if (await tx.bpmCard.count({ where: { etapaId: ELABORACAO } })) {
        throw new Error("Entraram cards na etapa após a prévia; refaça o plano.");
      }
      const atualizado = await tx.bpmPipeline.updateMany({ where: { id: PIPELINE, configVersion: pipeline.configVersion }, data: { configVersion: { increment: 1 } } });
      if (atualizado.count !== 1) throw new Error("Pipeline alterado durante a publicação.");
      const ids = new Map<string, string>();
      for (const [ordem, spec] of specs.entries()) {
        const criado = await tx.bpmCampo.create({ data: { pipelineId: PIPELINE, chave: spec.chave, nome: spec.nome,
          tipo: spec.tipo, escopo: "CARD", ordem, editavel: !('calculado' in spec), somenteLeitura: 'calculado' in spec,
          opcoesJson: 'opcoes' in spec ? JSON.stringify(spec.opcoes) : null,
          opcoes: 'opcoes' in spec ? { create: spec.opcoes.map((rotulo, index) => ({ chave: `opcao-${index}`, rotulo, ordem: index })) } : undefined,
        } });
        ids.set(spec.chave, criado.id);
      }
      const elaborado = ids.get(CHAVES.elaborado)!, enviado = ids.get(CHAVES.enviado)!;
      const condElaborado = cond(elaborado, "Sim"), condEnviado = cond(enviado, "Sim");
      const form = await tx.bpmEtapaFormulario.create({ data: { etapaId: ELABORACAO, versao: 1 } });
      const secao = await tx.bpmFormularioSecao.create({ data: { formularioId: form.id, chave: "elaboracao_contrato", titulo: "Elaboração e assinatura", ordem: 0 } });
      for (const [ordem, spec] of specs.entries()) {
        const campoId = ids.get(spec.chave)!;
        const condicao = spec.chave === CHAVES.dataElaboracao ? condElaborado
          : spec.chave === CHAVES.dataEnvio || spec.chave === CHAVES.contrato ? condEnviado : null;
        await tx.bpmCampoEtapaConfig.create({ data: { campoId, etapaId: ELABORACAO, visivel: true,
          editavel: !('calculado' in spec), somenteLeitura: 'calculado' in spec,
          obrigatorioSaida: spec.chave === CHAVES.elaborado || spec.chave === CHAVES.enviado,
          condicaoObrigatoriedadeJson: condicao ? JSON.stringify(condicao) : null,
          valorPadrao: spec.chave === CHAVES.dataElaboracao ? "{{agora.data}}" : spec.chave === CHAVES.dataEnvio ? "{{agora.instante}}" : null,
          ordem, grupo: "Elaboração e assinatura",
        } });
        await tx.bpmFormularioComponente.create({ data: { secaoId: secao.id, chave: `campo:${spec.chave}`, tipo: "CAMPO", campoId, ordem } });
      }
      const requirements = [
        ...fonteObrigatoria.map((chave, ordem) => ({ chave: `financeiro.elaboracao.ativa.conferir.${chave}`, campoId: fonte.get(chave)!.id,
          alvoTipo: "CAMPO", condicaoJson: JSON.stringify(condElaborado), mensagem: `${fonte.get(chave)!.nome} precisa ser conferido antes da elaboração.`, ordem })),
        { chave: "financeiro.elaboracao.ativa.enviado.sem.elaborar", campoId: null, alvoTipo: "REGRA",
          condicaoJson: JSON.stringify({ operador: "AND", condicoes: [condEnviado, vazioOuNao(elaborado)] }),
          mensagem: "Marque Contrato elaborado = Sim antes de enviar para assinatura.", ordem: 20 },
        { chave: "financeiro.elaboracao.ativa.elaborado.nao", campoId: null, alvoTipo: "REGRA",
          condicaoJson: JSON.stringify(vazioOuNao(elaborado)), mensagem: "Contrato elaborado precisa estar marcado como Sim.", ordem: 21 },
        { chave: "financeiro.elaboracao.ativa.enviado.nao", campoId: null, alvoTipo: "REGRA",
          condicaoJson: JSON.stringify(vazioOuNao(enviado)), mensagem: "Contrato enviado para assinatura precisa estar marcado como Sim.", ordem: 22 },
      ];
      for (const item of requirements) {
        if (item.condicaoJson) grupoCondicaoSchema.parse(JSON.parse(item.condicaoJson));
        await tx.bpmRequisito.create({ data: { ...item, pipelineId: PIPELINE, etapaId: ELABORACAO,
          fase: "DURING_STAGE", fonte: "ADMIN", ativo: true } });
      }
      type Automacao = { chave: string; nome: string; gatilhoTipo: string; gatilhoConfig: Record<string, unknown>;
        condicao?: unknown; acoes: Array<{ tipo: string; parametros: Record<string, unknown> }> };
      const automacoes: Automacao[] = [
        { chave: "financeiro.elaboracao.ativa.data", nome: "Contrato elaborado — registrar data",
          gatilhoTipo: "CAMPO_VALOR_ASSUMIDO", gatilhoConfig: { escopo: "ETAPAS", etapaId: ELABORACAO, campoId: elaborado, valor: "Sim" },
          acoes: [{ tipo: "ALTERAR_CAMPO", parametros: { campoId: ids.get(CHAVES.dataElaboracao), valor: "{{agora.data}}", somenteSeVazio: true } }] },
        { chave: "financeiro.elaboracao.ativa.envio", nome: "Contrato enviado — registrar envio e acompanhar assinatura",
          gatilhoTipo: "CAMPO_VALOR_ASSUMIDO", gatilhoConfig: { escopo: "ETAPAS", etapaId: ELABORACAO, campoId: enviado, valor: "Sim" },
          acoes: [
            { tipo: "ALTERAR_CAMPO", parametros: { campoId: ids.get(CHAVES.dataEnvio), valor: "{{agora.instante}}", somenteSeVazio: true } },
            { tipo: "ALTERAR_CAMPO", parametros: { campoId: ids.get(CHAVES.status), valor: "Aguardando assinatura", somenteSeVazio: true } },
            { tipo: "CRIAR_TAREFA", parametros: { titulo: "Acompanhar assinatura do contrato", tipo: "ASSINATURA_CONTRATO", prioridade: "NORMAL", naoDuplicarPendenteTipo: true } },
          ] },
        ...fonteAlerta.map((chave) => ({ chave: `financeiro.elaboracao.ativa.revisar.${chave}`,
          nome: `Revisar contrato após alterar ${fonte.get(chave)!.nome}`, gatilhoTipo: "CAMPO_ALTERADO",
          gatilhoConfig: { escopo: "GLOBAL_PIPELINE", campoId: fonte.get(chave)!.id }, condicao: condElaborado,
          acoes: [{ tipo: "CRIAR_ALERTA", parametros: { texto: `${fonte.get(chave)!.nome} foi alterado após a elaboração. Confira se o contrato precisa ser atualizado.` } }],
        })),
        { chave: "financeiro.elaboracao.ativa.gerador.radar", nome: "Gerador de Documentos — criar contrato RADAR",
          gatilhoTipo: "ENTRAR_COLUNA", gatilhoConfig: { escopo: "ETAPAS", etapaId: ELABORACAO },
          condicao: { operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: fonte.get(K.SERVICO)!.id }, operador: "contem", valor: "Radar" }] },
          acoes: [{ tipo: "GERAR_CONTRATO", parametros: { templateId: template.id,
            titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS", empresaContratadaId: contratada.id,
            campoIdContrato: ids.get(CHAVES.contrato), permitirPendencias: true,
            variaveis: {
              contratante_nome: `{{campo.${fonte.get(K.RAZAO_SOCIAL)!.id}}}`,
              contratante_cnpj: `{{campo.${fonte.get(K.CNPJ)!.id}}}`,
              contratante_endereco: `${`{{campo.${fonte.get(K.RUA)!.id}}}`}, nº ${`{{campo.${fonte.get(K.NUMERO)!.id}}}`}, ${`{{campo.${fonte.get(K.COMPLEMENTO)!.id}}}`}, bairro ${`{{campo.${fonte.get(K.BAIRRO)!.id}}}`}, ${`{{campo.${fonte.get(K.MUNICIPIO)!.id}}}`}/${`{{campo.${fonte.get(K.ESTADO)!.id}}}`}, CEP ${`{{campo.${fonte.get(K.CEP)!.id}}}`}`,
              contratante_email: `{{campo.${fonte.get(K.EMAIL)!.id}}}`,
              valor_total: `{{campo.${fonte.get(K.VALOR_BRUTO)!.id}}}`,
              __bpmServico: `{{campo.${fonte.get(K.SERVICO)!.id}}}`,
              __bpmFormaPagamento: `{{campo.${fonte.get(K.FORMA_PAGAMENTO)!.id}}}`,
              __bpmCondicaoNegociada: `{{campo.${fonte.get(K.CONDICAO)!.id}}}`,
            },
          } }],
        },
      ];
      for (const item of automacoes) {
        gatilhoConfigSchema.parse(item.gatilhoConfig);
        if (item.condicao) grupoCondicaoSchema.parse(item.condicao);
        const graph = validarGrafoAutomacao(grafo(item.acoes));
        const criada = await tx.bpmAutomacao.create({ data: { chave: item.chave, nome: item.nome,
          pipelineId: PIPELINE, etapaId: ELABORACAO, gatilhoTipo: item.gatilhoTipo,
          acaoTipo: item.acoes[0].tipo, parametrosJson: JSON.stringify(item.acoes[0].parametros), ativa: true, criadoPorId: 1 } });
        await tx.bpmAutomacaoVersao.create({ data: { automacaoId: criada.id, versao: 1, status: "ATIVA",
          gatilhoTipo: item.gatilhoTipo, gatilhoConfigJson: JSON.stringify(item.gatilhoConfig),
          condicaoJson: item.condicao ? JSON.stringify(item.condicao) : null,
          grafoJson: JSON.stringify(graph), timezone: "America/Sao_Paulo", criadoPorId: 1, ativadaEm: new Date() } });
      }
    }, { maxWait: 20_000, timeout: 120_000 });
    console.log(JSON.stringify({ mode: "apply", sucesso: true, financeiroVersion: pipeline.configVersion + 1,
      fields: specs.length, requirements: fonteObrigatoria.length + 3, automations: plano.automations }));
  }
} finally { await db.$disconnect(); }
