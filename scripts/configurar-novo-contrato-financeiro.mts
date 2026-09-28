/** Prévia por padrão. --apply publica somente após checkpoint Vault específico. */
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { FINANCIAL_FIELD_KEYS: K } = await import("../src/lib/bpm/pipeline-financeiro");
const args = process.argv.slice(2);
const aplicar = args.includes("--apply");
const arg = (key: string) => args.find((item) => item.startsWith(`--${key}=`))?.slice(key.length + 3);
const FIN = "cmuih4i54000209gmmyqrg557";
const RADAR = "cmuih48la000009gmzw3wwuzf";
const REGIMES = ["Regime Normal", "Simples Nacional", "Lucro Real", "Presumido", "Lucro Presumido", "Outro"];
type Fonte = [string, string] | null;
type Spec = { chave: string; nome: string; tipo: string; grupo: string; obrigatorio?: boolean; fonte?: Fonte; origem?: string; opcoes?: string[]; calculado?: boolean };
const specs: Spec[] = [
  { chave: K.CNPJ, nome: "CNPJ", tipo: "cnpj", grupo: "Dados cadastrais", obrigatorio: true, fonte: ["CLIENTE", "cnpj"] },
  { chave: K.RAZAO_SOCIAL, nome: "Razão Social", tipo: "texto", grupo: "Dados cadastrais", obrigatorio: true, fonte: ["CLIENTE", "razaoSocial"] },
  { chave: K.RUA, nome: "Rua", tipo: "texto", grupo: "Dados cadastrais", obrigatorio: true },
  { chave: K.NUMERO, nome: "Número", tipo: "texto", grupo: "Dados cadastrais", obrigatorio: true },
  { chave: K.COMPLEMENTO, nome: "Complemento", tipo: "texto", grupo: "Dados cadastrais" },
  { chave: K.BAIRRO, nome: "Bairro", tipo: "texto", grupo: "Dados cadastrais", obrigatorio: true },
  { chave: K.CEP, nome: "CEP", tipo: "texto", grupo: "Dados cadastrais", obrigatorio: true },
  { chave: K.MUNICIPIO, nome: "Município", tipo: "texto", grupo: "Dados cadastrais", obrigatorio: true, fonte: ["CLIENTE", "municipio"] },
  { chave: K.ESTADO, nome: "Estado", tipo: "texto", grupo: "Dados cadastrais", obrigatorio: true, fonte: ["CLIENTE", "uf"] },
  { chave: K.EMAIL, nome: "E-mail", tipo: "email", grupo: "Dados cadastrais", obrigatorio: true, fonte: ["CONTATO", "email"] },
  { chave: K.REGIME_CLIENTE, nome: "Regime tributário do cliente", tipo: "selecao", grupo: "Dados cadastrais", obrigatorio: true, fonte: ["CLIENTE", "regimeTributario"], opcoes: REGIMES },
  { chave: K.SERVICO, nome: "Serviço contratado", tipo: "texto", grupo: "Dados da contratação", obrigatorio: true, fonte: ["CARD", "servico"] },
  { chave: K.VALOR_BRUTO, nome: "Valor bruto do contrato", tipo: "moeda", grupo: "Dados da contratação", obrigatorio: true, origem: "alpha.radar.viabilidade.valor_acordado" },
  { chave: K.FORMA_PAGAMENTO, nome: "Forma de pagamento", tipo: "selecao", grupo: "Dados da contratação", obrigatorio: true, origem: "alpha.radar.viabilidade.forma_pagamento" },
  { chave: K.CONDICAO, nome: "Condição negociada", tipo: "texto_longo", grupo: "Dados da contratação", obrigatorio: true },
  { chave: K.VENDEDOR, nome: "Vendedor responsável", tipo: "usuario", grupo: "Dados da contratação", obrigatorio: true, fonte: ["CARD", "responsavelId"] },
  { chave: K.ORIGEM, nome: "Origem do cliente", tipo: "selecao", grupo: "Dados da contratação", obrigatorio: true, opcoes: ["Direto", "Parceiro", "Outro"] },
  { chave: K.PARCEIRO, nome: "Parceiro responsável", tipo: "texto", grupo: "Dados da contratação", fonte: ["PARCEIRO", "nome"] },
  { chave: K.REGIME_PRESTADOR, nome: "Regime tributário do prestador", tipo: "selecao", grupo: "Campos financeiros", opcoes: REGIMES },
  { chave: K.IRRF_APLICAVEL, nome: "IRRF aplicável", tipo: "selecao", grupo: "Campos financeiros", opcoes: ["Sim", "Não"] },
  { chave: K.ALIQUOTA_IRRF, nome: "Alíquota IRRF", tipo: "percentual", grupo: "Campos financeiros" },
  { chave: K.VALOR_IRRF, nome: "Valor IRRF", tipo: "moeda", grupo: "Campos financeiros", calculado: true },
  { chave: K.CSRF_APLICAVEL, nome: "CSRF aplicável", tipo: "selecao", grupo: "Campos financeiros", opcoes: ["Sim", "Não"] },
  { chave: K.ALIQUOTA_CSRF, nome: "Alíquota CSRF", tipo: "percentual", grupo: "Campos financeiros" },
  { chave: K.VALOR_CSRF, nome: "Valor CSRF", tipo: "moeda", grupo: "Campos financeiros", calculado: true },
  { chave: K.TOTAL_RETENCOES, nome: "Total de retenções", tipo: "moeda", grupo: "Campos financeiros", calculado: true },
  { chave: K.VALOR_LIQUIDO, nome: "Valor líquido para pagamento", tipo: "moeda", grupo: "Campos financeiros", calculado: true },
  { chave: K.VENCIMENTO, nome: "Vencimento", tipo: "data", grupo: "Campos financeiros" },
  { chave: K.DADOS_PAGAMENTO, nome: "Link/dados para pagamento", tipo: "texto_longo", grupo: "Campos financeiros" },
  { chave: K.MEMORIA_CALCULO, nome: "Memória de cálculo", tipo: "texto_longo", grupo: "Campos financeiros", calculado: true },
  { chave: K.STATUS_FINANCEIRO, nome: "Status financeiro", tipo: "selecao", grupo: "Campos financeiros", opcoes: ["Aguardando pagamento"], calculado: true },
];
const grupos = ["Dados cadastrais", "Dados da contratação", "Campos financeiros"];

try {
  const [financeiro, radar, camposExistentes] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: FIN }, select: { id: true, chave: true, configVersion: true, etapas: { where: { ativo: true }, select: { id: true, chave: true, nome: true, formulario: { select: { id: true, versao: true, secoes: { select: { id: true, chave: true, componentes: { select: { id: true, campoId: true } } } } } } } } } }),
    db.bpmPipeline.findUnique({ where: { id: RADAR }, select: { id: true, nome: true, configVersion: true, etapas: { where: { nome: { in: ["Em tratativas", "Fechado"] }, ativo: true }, select: { id: true, nome: true, formulario: { select: { id: true, versao: true } } } } } }),
    db.bpmCampo.findMany({ where: { OR: [{ pipelineId: FIN }, { pipelineId: RADAR }] }, select: { id: true, pipelineId: true, chave: true, nome: true, tipo: true, ativo: true } }),
  ]);
  const novo = financeiro?.etapas.find((etapa) => etapa.chave === "solicitacao_contrato");
  const elaboracao = financeiro?.etapas.find((etapa) => etapa.chave === "elaboracao_contrato");
  const fechado = radar?.etapas.find((etapa) => etapa.nome === "Fechado");
  const tratativas = radar?.etapas.find((etapa) => etapa.nome === "Em tratativas");
  if (financeiro?.chave !== "financeiro" || !novo?.formulario || !elaboracao || radar?.nome !== "Revisão de Radar" || !fechado?.formulario || !tratativas?.formulario) throw new Error("Pipeline ou formulário ativo mudou; refaça o plano.");
  const financeiroAtual = camposExistentes.filter((campo) => campo.pipelineId === FIN);
  if (financeiroAtual.length !== 2 || novo.formulario.secoes.flatMap((secao) => secao.componentes).length !== 2) throw new Error("Novo Contrato já foi configurado; revisão manual necessária.");
  const valor = financeiroAtual.find((campo) => campo.chave === "alpha.valor.acordado.no.contrato");
  const forma = financeiroAtual.find((campo) => campo.chave === K.FORMA_PAGAMENTO);
  if (!valor || !forma) throw new Error("Campos negociados atuais divergentes.");
  const origemPorChave = new Map(camposExistentes.filter((campo) => campo.pipelineId === RADAR && campo.chave).map((campo) => [campo.chave, campo]));
  if (!origemPorChave.has("alpha.radar.viabilidade.valor_acordado") || !origemPorChave.has("alpha.radar.viabilidade.forma_pagamento")) throw new Error("Fontes comerciais divergentes.");
  const preview = {
    financeiro: { id: FIN, versao: financeiro.configVersion, etapaId: novo.id, formularioVersao: novo.formulario.versao },
    comercial: { id: RADAR, versao: radar.configVersion, etapaFechadoId: fechado.id, formularioVersao: fechado.formulario.versao, etapaTratativasId: tratativas.id, formularioTratativasVersao: tratativas.formulario.versao },
    campos: specs.map((spec) => ({ chave: spec.chave, nome: spec.nome, tipo: spec.tipo, grupo: spec.grupo, obrigatorioSaida: !!spec.obrigatorio, fonte: spec.origem ?? (spec.fonte ? `${spec.fonte[0]}.${spec.fonte[1]}` : "preenchimento comercial/financeiro"), calculado: !!spec.calculado })),
    inserts: { camposComerciais: 16, camposFinanceiros: 29, mapeamentos: 18, secoesFinanceiras: 2, secoesComerciais: 2 },
    cardsTeste: ["cmuini24h000a09gmadd2zmu0", "cmulnujrr00060agmrmuf4t8i"],
  };
  if (!aplicar) { console.log(JSON.stringify({ modo: "preview", ...preview }, null, 2)); process.exitCode = 0; }
  else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")) throw new Error("Turso remoto explícito obrigatório.");
    if (arg("approval") !== "AUTORIZO_NOVO_CONTRATO_FINANCEIRO") throw new Error("Autorização específica ausente.");
    if (Number(arg("expect-financeiro")) !== financeiro.configVersion || Number(arg("expect-radar")) !== radar.configVersion) throw new Error("Versão mudou.");
    const backup = arg("backup"), manifest = arg("manifest"), adminId = Number(arg("admin-id"));
    if (!backup || !manifest || !Number.isSafeInteger(adminId)) throw new Error("Backup, manifesto e administrador obrigatórios.");
    const m = JSON.parse(readFileSync(manifest, "utf8"));
    const b = statSync(backup), criado = Date.parse(m.generatedAt);
    if (!backup.includes("database-backups/pre-change/") || !String(m.reason).includes("novo-contrato-financeiro") || !Number.isFinite(criado) || Date.now() - criado > 48 * 3600_000 || criado > Date.now() || b.size < 1_000_000 || b.size !== m.sizeBytes || createHash("sha256").update(readFileSync(backup)).digest("hex") !== m.sha256) throw new Error("Backup dedicado, íntegro e recente obrigatório.");
    execFileSync("node", ["scripts/verify-turso-backup.mjs", backup, manifest], { stdio: "pipe" });
    const admin = await db.usuarios.findUnique({ where: { id: adminId }, select: { role: true, status: true } });
    if (admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Administrador inválido.");
    await db.$transaction(async (tx) => {
      const f = await tx.bpmPipeline.updateMany({ where: { id: FIN, configVersion: financeiro.configVersion }, data: { configVersion: { increment: 1 } } });
      const r = await tx.bpmPipeline.updateMany({ where: { id: RADAR, configVersion: radar.configVersion }, data: { configVersion: { increment: 1 } } });
      if (f.count !== 1 || r.count !== 1) throw new Error("Configuração alterada durante publicação.");
      await tx.bpmCampo.update({ where: { id: valor.id }, data: { chave: K.VALOR_BRUTO, nome: "Valor bruto do contrato", configVersao: { increment: 1 } } });
      const idsFinanceiro = new Map<string, string>([[K.VALOR_BRUTO, valor.id], [K.FORMA_PAGAMENTO, forma.id]]);
      const idsOrigem = new Map<string, string>([[K.VALOR_BRUTO, origemPorChave.get("alpha.radar.viabilidade.valor_acordado")!.id], [K.FORMA_PAGAMENTO, origemPorChave.get("alpha.radar.viabilidade.forma_pagamento")!.id]]);
      for (const [ordem, spec] of specs.entries()) {
        if (idsFinanceiro.has(spec.chave)) continue;
        const criado = await tx.bpmCampo.create({ data: {
          pipelineId: FIN, chave: spec.chave, nome: spec.nome, tipo: spec.tipo, ordem,
          escopo: "CARD", opcoesJson: spec.opcoes ? JSON.stringify(spec.opcoes) : null,
          editavel: !spec.calculado, somenteLeitura: !!spec.calculado,
          opcoes: spec.opcoes ? { create: spec.opcoes.map((rotulo, index) => ({ chave: `opcao-${index}`, rotulo, ordem: index })) } : undefined,
        } });
        idsFinanceiro.set(spec.chave, criado.id);
      }
      for (const [ordem, spec] of specs.filter((item) => ![K.VALOR_BRUTO, K.FORMA_PAGAMENTO].includes(item.chave as typeof K.VALOR_BRUTO)).entries()) {
        if (spec.grupo === "Campos financeiros") continue;
        const origem = await tx.bpmCampo.create({ data: {
          pipelineId: RADAR, chave: `alpha.radar.contrato.${spec.chave.slice(6).replaceAll(".", "_")}`,
          nome: spec.nome, tipo: spec.tipo, ordem: 100 + ordem,
          escopo: spec.fonte ? "GLOBAL" : "CARD", fonteEntidade: spec.fonte?.[0] ?? null,
          fonteAtributo: spec.fonte?.[1] ?? null, opcoesJson: spec.opcoes ? JSON.stringify(spec.opcoes) : null,
          opcoes: spec.opcoes ? { create: spec.opcoes.map((rotulo, index) => ({ chave: `opcao-${index}`, rotulo, ordem: index })) } : undefined,
        } });
        idsOrigem.set(spec.chave, origem.id);
        for (const etapaId of [tratativas.id, fechado.id]) {
          await tx.bpmCampoEtapaConfig.create({ data: { campoId: origem.id, etapaId, visivel: true, editavel: true, ordem: 100 + ordem, grupo: "Dados para o Financeiro" } });
        }
      }
      for (const formularioId of [tratativas.formulario!.id, fechado.formulario!.id]) {
        const secaoComercial = await tx.bpmFormularioSecao.create({ data: { formularioId, chave: "dados_financeiro", titulo: "Dados para o Financeiro", ordem: 10 } });
        for (const [ordem, spec] of specs.filter((item) => idsOrigem.has(item.chave) && ![K.VALOR_BRUTO, K.FORMA_PAGAMENTO].includes(item.chave as typeof K.VALOR_BRUTO)).entries()) {
          await tx.bpmFormularioComponente.create({ data: { secaoId: secaoComercial.id, chave: `origem:${spec.chave}`, tipo: "CAMPO", campoId: idsOrigem.get(spec.chave), ordem } });
        }
      }
      const secaoPorGrupo = new Map<string, string>();
      for (const [ordem, grupo] of grupos.entries()) {
        const existente = novo.formulario!.secoes.find((secao) => secao.chave === "dados_negociacao");
        if (grupo === "Dados da contratação" && existente) {
          await tx.bpmFormularioSecao.update({ where: { id: existente.id }, data: { titulo: grupo, ordem } });
          secaoPorGrupo.set(grupo, existente.id);
        } else {
          const criada = await tx.bpmFormularioSecao.create({ data: { formularioId: novo.formulario!.id, chave: ["dados_cadastrais", "dados_contratacao", "campos_financeiros"][ordem], titulo: grupo, ordem } });
          secaoPorGrupo.set(grupo, criada.id);
        }
      }
      for (const [ordem, spec] of specs.entries()) {
        const campoId = idsFinanceiro.get(spec.chave)!;
        const condicao = spec.chave === K.PARCEIRO ? { operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: idsFinanceiro.get(K.ORIGEM) }, operador: "igual", valor: "Parceiro" }] }
          : spec.chave === K.ALIQUOTA_IRRF || spec.chave === K.ALIQUOTA_CSRF ? { operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: idsFinanceiro.get(spec.chave === K.ALIQUOTA_IRRF ? K.IRRF_APLICAVEL : K.CSRF_APLICAVEL) }, operador: "igual", valor: "Sim" }] } : null;
        const configuracao = {
          visivel: true, editavel: !spec.calculado, somenteLeitura: !!spec.calculado,
          obrigatorioSaida: !!spec.obrigatorio, condicaoObrigatoriedadeJson: condicao ? JSON.stringify(condicao) : null,
          ordem, grupo: spec.grupo,
        };
        await tx.bpmCampoEtapaConfig.upsert({ where: { campoId_etapaId: { campoId, etapaId: novo.id } },
          create: { campoId, etapaId: novo.id, ...configuracao }, update: configuracao });
        const componente = novo.formulario!.secoes.flatMap((secao) => secao.componentes).find((item) => item.campoId === campoId);
        if (componente) await tx.bpmFormularioComponente.update({ where: { id: componente.id }, data: { secaoId: secaoPorGrupo.get(spec.grupo)!, ordem } });
        else await tx.bpmFormularioComponente.create({ data: { secaoId: secaoPorGrupo.get(spec.grupo)!, chave: `campo:${spec.chave}`, tipo: "CAMPO", campoId, ordem } });
        const origemId = idsOrigem.get(spec.chave);
        if (origemId) await tx.bpmCampoMapeamento.upsert({ where: { campoDestinoId: campoId }, create: { campoOrigemId: origemId, campoDestinoId: campoId, modo: "COPIAR", ativo: true }, update: { campoOrigemId: origemId, modo: "COPIAR", ativo: true } });
      }
      await tx.bpmEtapaFormulario.update({ where: { id: novo.formulario!.id }, data: { versao: { increment: 1 } } });
      await tx.bpmEtapaFormulario.update({ where: { id: fechado.formulario!.id }, data: { versao: { increment: 1 } } });
      await tx.bpmEtapaFormulario.update({ where: { id: tratativas.formulario!.id }, data: { versao: { increment: 1 } } });
      await tx.bpmPipelineConfigAuditoria.create({ data: { pipelineId: FIN, adminId, campoAlterado: "NOVO_CONTRATO_FINANCEIRO_PUBLICADO", valorAnteriorJson: JSON.stringify(preview.financeiro), valorNovoJson: JSON.stringify({ campos: [...idsFinanceiro], fontes: [...idsOrigem] }) } });
      await tx.bpmPipelineConfigAuditoria.create({ data: { pipelineId: RADAR, adminId, campoAlterado: "DADOS_COMERCIAIS_PARA_FINANCEIRO_PUBLICADOS", valorAnteriorJson: JSON.stringify(preview.comercial), valorNovoJson: JSON.stringify({ fontes: [...idsOrigem] }) } });
    }, { maxWait: 20_000, timeout: 120_000 });
    console.log(JSON.stringify({ modo: "apply", sucesso: true, versoes: { financeiro: financeiro.configVersion + 1, comercial: radar.configVersion + 1 } }));
  }
} finally { await db.$disconnect(); }
