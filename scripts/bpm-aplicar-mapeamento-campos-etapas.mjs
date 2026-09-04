import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";

config({ path: ".env.local" });
const APPLY = process.argv.includes("--apply");
const rawUrl = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
if (!rawUrl || !authToken) throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios.");
const host = new URL(rawUrl.replace(/^libsql:\/\//, "https://")).host;
if (host !== "banco-alpha-alphacomex.aws-us-east-1.turso.io") throw new Error(`Destino não autorizado: ${host}`);
const client = createClient({ url: `https://${host}`, authToken });

const id = () => `c${randomBytes(12).toString("hex")}`;
const normalizar = (valor) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const chave = (valor) => normalizar(valor).replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 110);
const agora = () => new Date().toISOString();

const CAMPOS = {
  "Nome do responsável": ["texto", "GLOBAL"],
  CNPJ: ["cnpj", "GLOBAL", "CLIENTE", "cnpj"],
  "Razão Social": ["texto", "GLOBAL", "CLIENTE", "razaoSocial"],
  Estado: ["texto", "GLOBAL", "CLIENTE", "uf"],
  Município: ["texto", "GLOBAL", "CLIENTE", "municipio"],
  "Regime tributário": ["selecao", "GLOBAL", "CLIENTE", "regimeTributario"],
  "Data de abertura da empresa": ["data", "GLOBAL", null, null, ["Data de constituição"]],
  "Situação do capital social": ["texto_longo", "GLOBAL"],
  "Contato responsável/representante": ["texto", "GLOBAL", "CONTATO", "nome"],
  "CPF do responsável pelo processo": ["cpf", "CARD"],
  "Responsável pelo processo": ["usuario", "CARD"],
  "Radar pretendido": ["selecao", "GLOBAL"],
  "Confirmar serviço": ["selecao", "GLOBAL"],
  Qualificação: ["selecao", "GLOBAL"],
  "Canal/origem do cliente": ["selecao", "GLOBAL", null, null, ["Canal de origem", "Origem do cliente"]],
  "Embasamento do processo": ["texto_longo", "GLOBAL"],
  "Radar atual": ["selecao", "GLOBAL"],
  "Mês de protocolo": ["texto", "GLOBAL", null, null, ["Mês para protocolar"]],
  "Faturamento dos últimos 5 anos": ["texto_longo", "GLOBAL", null, null, ["Faturamento nos últimos 5 anos"]],
  "Status da sede": ["selecao", "GLOBAL"],
  Armazenagem: ["texto_longo", "GLOBAL", null, null, ["Armazenamento"]],
  "Contas/faturas": ["texto_longo", "GLOBAL", null, null, ["Faturas sob titularidade da empresa"]],
  "Produtos comercializados": ["texto_longo", "GLOBAL"],
  "Atuação da empresa": ["texto_longo", "GLOBAL"],
  "Tributos pagos nos últimos 6 meses": ["texto_longo", "GLOBAL", null, null, ["Tributos pagos no último semestre"]],
  Fonte: ["texto", "GLOBAL"],
  "Vendedor(a)": ["usuario", "GLOBAL", null, null, ["Vendedor responsável"]],
  "Valor acordado no contrato": ["moeda", "GLOBAL", null, null, ["Valor bruto do contrato", "Valor contratado"]],
  "Forma de pagamento": ["selecao", "GLOBAL", null, null, ["Forma de pagamento utilizada"]],
  "Motivo de Lost": ["selecao", "CARD"],
  "Resumo da reunião": ["texto_longo", "CARD"],
  "Resultado da revisão": ["texto_longo", "CARD"],
  "Responsável pela revisão": ["usuario", "CARD"],
  "Data do protocolo": ["data", "CARD"],
  "Certificado digital utilizado": ["texto", "CARD"],
  "Número do protocolo": ["texto", "CARD"],
  "Informações de conferência": ["texto_longo", "CARD"],
  "Documentos/códigos utilizados": ["texto_longo", "CARD"],
  "Prazo de análise/devolutiva do fiscal": ["data", "CARD"],
  "Andamento/status atual": ["selecao", "CARD"],
  "Petição/anexo": ["arquivo", "CARD"],
  "Data relacionada à petição": ["data", "CARD"],
  Prazo: ["data", "CARD"],
  "Prazo do fiscal": ["data", "CARD"],
  "Data da exigência": ["data", "CARD"],
  "Motivo do indeferimento/exigência": ["selecao", "CARD"],
  "Classificação do motivo": ["selecao", "CARD"],
  Descrição: ["texto_longo", "CARD"],
  "Data da resposta": ["data", "CARD"],
  "Solução adotada": ["selecao", "CARD"],
  "Descrição da solução": ["texto_longo", "CARD"],
  "Data do deferimento": ["data", "CARD"],
  "Tentativa do deferimento": ["selecao", "CARD"],
  "Validação da solução adotada": ["booleano", "CARD"],
  "Duração do processo": ["numero", "CARD"],
  "Oportunidades de novos serviços": ["texto_longo", "CARD"],
  Rua: ["texto", "GLOBAL"], Número: ["texto", "GLOBAL"], Complemento: ["texto", "GLOBAL"],
  Bairro: ["texto", "GLOBAL"], CEP: ["texto", "GLOBAL"], "E-mail": ["email", "GLOBAL", "CONTATO", "email"],
  "Serviço contratado": ["texto", "GLOBAL"], "Condição negociada": ["texto_longo", "GLOBAL"],
  "Parceiro responsável": ["texto", "GLOBAL"],
  "Contrato elaborado": ["booleano", "CARD"], "Data de elaboração": ["data", "CARD"],
  "Contrato enviado para assinatura": ["booleano", "CARD"], "Data do envio": ["data", "CARD"],
  "Link/arquivo do contrato": ["arquivo", "CARD"], "Status da assinatura": ["selecao", "CARD"],
  "Status do contrato": ["selecao", "CARD"], "Data da assinatura": ["data", "CARD"],
  "Contrato assinado/anexo": ["arquivo", "CARD"], "IRRF aplicável": ["booleano", "CARD"],
  "Valor do IRRF": ["moeda", "CARD"], "CSRF aplicável": ["booleano", "CARD"],
  "Valor do CSRF": ["moeda", "CARD"], "Valor líquido a pagar": ["moeda", "CARD"],
  Vencimento: ["data", "CARD"], "Link/dados para pagamento": ["url", "CARD"],
  "Status financeiro": ["selecao", "CARD"], "Pagamento confirmado": ["booleano", "CARD"],
  "Data do pagamento": ["data", "CARD"], "Valor esperado": ["moeda", "CARD"],
  "Valor recebido": ["moeda", "CARD"], Comprovante: ["arquivo", "CARD"],
  "Pagamento no êxito": ["booleano", "CARD"], "NF emitida": ["booleano", "CARD"],
  "Número da NF": ["texto", "CARD"], "Data de emissão": ["data", "CARD"],
  "Valor da NF": ["moeda", "CARD"], "Arquivo/link da NF": ["arquivo", "CARD"],
};

const OPCOES = {
  Qualificação: ["Sem qualificação", "Qualificado"],
  "Tentativa do deferimento": ["Primeira", "Segunda", "Terceira", "Outras"],
  "Contrato elaborado": ["Sim", "Não"], "Contrato enviado para assinatura": ["Sim", "Não"],
  "Pagamento confirmado": ["Sim", "Não"], "NF emitida": ["Sim", "Não"],
};

const s = (pipeline, etapa, grupo, campos, flags = {}) => ({ pipeline, etapa, grupo, campos, ...flags });
const ANALISE = ["Embasamento do processo", "Radar pretendido", "Radar atual", "Mês de protocolo", "Regime tributário", "Data de abertura da empresa", "Situação do capital social", "Faturamento dos últimos 5 anos", "Status da sede", "Armazenagem", "Contas/faturas", "Produtos comercializados", "Atuação da empresa", "Tributos pagos nos últimos 6 meses", "Fonte", "Estado", "Vendedor(a)", "Contato responsável/representante"];
const ETAPAS = [
  s("Revisão de Radar", "Novos leads", "Qualificação", ["Nome do responsável", "CNPJ", "Radar pretendido", "Confirmar serviço", "Qualificação", "Canal/origem do cliente"], { obrigatorios: ["Nome do responsável", "CNPJ", "Radar pretendido", "Confirmar serviço"] }),
  s("Revisão de Radar", "Reunião Agendada", "Análise de Viabilidade", ANALISE),
  s("Revisão de Radar", "Fechado", "Contratação", ["Valor acordado no contrato", "Forma de pagamento"]),
  s("Revisão de Radar", "Lost", "Encerramento", ["Motivo de Lost"], { obrigatoriosSaida: ["Motivo de Lost"] }),
  s("Operacional", "Boas-vindas", "Dados do processo", [...ANALISE, "CNPJ", "Razão Social", "Responsável pelo processo", "CPF do responsável pelo processo"]),
  s("Operacional", "Alinhamento Estratégico agendado", "Reunião", ["Responsável pelo processo", "Resumo da reunião"], { obrigatoriosSaida: ["Resumo da reunião"] }),
  s("Operacional", "Em análise", "Análise documental", ANALISE),
  s("Operacional", "Revisão", "Revisão", ["Resultado da revisão", "Responsável pela revisão"]),
  s("Operacional", "Protocolo", "Resultado e protocolo", ["Resultado da revisão", "Data do protocolo", "Certificado digital utilizado"]),
  s("Operacional", "Revisão do protocolo", "Conferência do protocolo", ["Data do protocolo", "Número do protocolo", "Informações de conferência", "Documentos/códigos utilizados"]),
  s("Operacional", "Aguardando Despacho", "Acompanhamento fiscal", ["CNPJ", "Data do protocolo", "Número do protocolo", "Prazo de análise/devolutiva do fiscal", "Andamento/status atual"]),
  s("Operacional", "Petição", "Petição", ["Petição/anexo", "Data relacionada à petição", "Prazo"], { obrigatoriosSaida: ["Petição/anexo"] }),
  s("Operacional", "Exigência Fiscal", "Exigência", ["Prazo do fiscal", "Data da exigência", "Motivo do indeferimento/exigência", "Classificação do motivo", "Descrição"]),
  s("Operacional", "Resposta ao Fiscal", "Resposta", ["Data da resposta", "Solução adotada", "Descrição da solução", "Petição/anexo", "Prazo"], { obrigatoriosSaida: ["Petição/anexo"] }),
  s("Operacional", "Deferido", "Conclusão", ["Data do deferimento", "Tentativa do deferimento", "Solução adotada", "Validação da solução adotada", "Duração do processo", "Oportunidades de novos serviços"]),
  s("Financeiro", "Solicitação de Contrato", "Dados cadastrais", ["CNPJ", "Razão Social", "Rua", "Número", "Complemento", "Bairro", "CEP", "Município", "Estado", "E-mail", "Regime tributário"], { obrigatoriosSaida: ["CNPJ", "Razão Social", "Rua", "Número", "Bairro", "CEP", "Município", "Estado", "E-mail", "Regime tributário"] }),
  s("Financeiro", "Solicitação de Contrato", "Dados da contratação", ["Serviço contratado", "Valor acordado no contrato", "Forma de pagamento", "Condição negociada", "Vendedor(a)", "Canal/origem do cliente", "Parceiro responsável"], { obrigatoriosSaida: ["Serviço contratado", "Valor acordado no contrato", "Forma de pagamento", "Vendedor(a)", "Canal/origem do cliente"] }),
  s("Financeiro", "Elaboração do Contrato", "Contrato", ["Contrato elaborado", "Data de elaboração", "Contrato enviado para assinatura", "Data do envio", "Link/arquivo do contrato"]),
  s("Financeiro", "Formalização", "Contrato", ["Status da assinatura", "Status do contrato", "Data da assinatura", "Contrato assinado/anexo"]),
  s("Financeiro", "Formalização", "Pagamento", ["Valor acordado no contrato", "IRRF aplicável", "Valor do IRRF", "CSRF aplicável", "Valor do CSRF", "Valor líquido a pagar", "Forma de pagamento", "Vencimento", "Link/dados para pagamento", "Status financeiro"]),
  s("Financeiro", "Pagamento", "Confirmação do pagamento", ["Pagamento confirmado", "Data do pagamento", "Valor esperado", "Valor recebido", "Forma de pagamento", "Comprovante", "Pagamento no êxito"]),
  s("Financeiro", "Nota Fiscal", "Nota fiscal", ["NF emitida", "Número da NF", "Data de emissão", "Valor da NF", "Arquivo/link da NF"]),
  s("Financeiro", "Concluídos", "Dados consolidados", ["CNPJ", "Razão Social", "Contato responsável/representante", "E-mail", "Serviço contratado", "Contrato assinado/anexo", "Valor acordado no contrato", "Forma de pagamento", "Pagamento confirmado", "NF emitida", "Vendedor(a)", "Parceiro responsável", "Canal/origem do cliente"]),
];

async function executar(executor) {
  const pipelinesRs = await executor.execute({ sql: "SELECT id, nome FROM BpmPipeline WHERE ativo = true" });
  const pipelines = new Map(pipelinesRs.rows.map((row) => [normalizar(String(row.nome)), row]));
  const pipelineIds = [...new Set(ETAPAS.map((item) => pipelines.get(normalizar(item.pipeline))?.id).filter(Boolean))];
  if (pipelineIds.length !== 3) throw new Error("Pipelines Comercial/Revisão de Radar, Operacional e Financeiro não foram resolvidos univocamente.");
  const placeholders = pipelineIds.map(() => "?").join(",");
  const etapasRs = await executor.execute({ sql: `SELECT id, nome, pipelineId, ativo FROM BpmEtapa WHERE pipelineId IN (${placeholders})`, args: pipelineIds });
  const etapaPorChave = new Map();
  for (const row of etapasRs.rows) {
    if (!row.ativo) continue;
    const key = `${row.pipelineId}:${normalizar(String(row.nome))}`;
    if (etapaPorChave.has(key)) throw new Error(`Etapa ativa duplicada: ${row.nome}`);
    etapaPorChave.set(key, row);
  }
  const camposRs = await executor.execute({ sql: "SELECT c.*, (SELECT COUNT(*) FROM BpmCardCampoValor v WHERE v.campoId = c.id) AS usos FROM BpmCampo c ORDER BY usos DESC, c.createdAt" });
  const campos = [...camposRs.rows];
  const resolvidos = new Map();
  const duplicatasAtivas = [];
  let duplicatasDesativadas = 0;
  let criados = 0;
  for (const [nome, definicao] of Object.entries(CAMPOS)) {
    const aliases = [nome, ...(definicao[4] ?? [])].map(normalizar);
    const candidatas = campos.filter((campo) => aliases.includes(normalizar(String(campo.nome))));
    let campo = candidatas[0];
    if (candidatas.filter((item) => Boolean(item.ativo)).length > 1) {
      duplicatasAtivas.push({ nome, campos: candidatas.filter((item) => Boolean(item.ativo)).map((item) => ({ id: String(item.id), usos: Number(item.usos ?? 0), pipelineId: String(item.pipelineId) })) });
    }
    if (!campo) {
      const primeira = ETAPAS.find((etapa) => etapa.campos.includes(nome));
      const pipeline = primeira && pipelines.get(normalizar(primeira.pipeline));
      if (!pipeline) throw new Error(`Pipeline-base ausente para ${nome}`);
      campo = {
        id: id(), pipelineId: pipeline.id, etapaId: null, nome, tipo: definicao[0], opcoesJson: null,
        obrigatorio: false, ordem: 0, ativo: true, escopo: definicao[1], valorPadrao: null,
        fonteEntidade: definicao[2] ?? null, fonteAtributo: definicao[3] ?? null,
        entidadeGlobal: definicao[1] === "GLOBAL" && !definicao[2] ? "CLIENTE" : null,
        visivel: true, editavel: !definicao[2], somenteLeitura: Boolean(definicao[2]), configVersao: 1,
        createdAt: agora(), updatedAt: agora(), chave: `alpha.${chave(nome)}`,
      };
      if (APPLY) await executor.execute({
        sql: `INSERT INTO BpmCampo (id, chave, pipelineId, etapaId, nome, tipo, opcoesJson, obrigatorio, ordem, ativo, escopo, valorPadrao, fonteEntidade, fonteAtributo, entidadeGlobal, visivel, editavel, somenteLeitura, configVersao, createdAt, updatedAt) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [campo.id, campo.chave, campo.pipelineId, campo.nome, campo.tipo, campo.opcoesJson, campo.obrigatorio, campo.ordem, campo.ativo, campo.escopo, campo.valorPadrao, campo.fonteEntidade, campo.fonteAtributo, campo.entidadeGlobal, campo.visivel, campo.editavel, campo.somenteLeitura, campo.configVersao, campo.createdAt, campo.updatedAt],
      });
      campos.push(campo); criados++;
    } else if (APPLY) {
      for (const duplicata of candidatas.slice(1).filter((item) => Boolean(item.ativo))) {
        if (Number(duplicata.usos ?? 0) > 0) throw new Error(`Duplicata de ${nome} possui valores e exige reconciliação manual: ${duplicata.id}`);
        await executor.execute({ sql: "UPDATE BpmCampo SET ativo = false, updatedAt = ? WHERE id = ?", args: [agora(), duplicata.id] });
        duplicata.ativo = false;
        duplicatasDesativadas++;
      }
      const escopoEsperado = definicao[1];
      const fonteEsperada = definicao[2] ?? null;
      const atributoEsperado = definicao[3] ?? null;
      if (escopoEsperado === "GLOBAL" && !fonteEsperada && campo.escopo !== "GLOBAL") {
        const valores = await executor.execute({
          sql: `SELECT v.valor, c.empresaId, c.updatedAt
                FROM BpmCardCampoValor v JOIN BpmCard c ON c.id = v.cardId
                WHERE v.campoId = ? AND TRIM(COALESCE(v.valor, '')) <> ''
                ORDER BY c.updatedAt DESC`,
          args: [campo.id],
        });
        const porCliente = new Map();
        for (const item of valores.rows) {
          const empresaId = String(item.empresaId);
          const atual = porCliente.get(empresaId);
          if (atual && atual !== item.valor) throw new Error(`Valores conflitantes para ${nome} no cliente ${empresaId}`);
          porCliente.set(empresaId, String(item.valor));
        }
        for (const [empresaId, valor] of porCliente) {
          await executor.execute({
            sql: `INSERT INTO BpmCampoValorGlobal (id, campoId, entidadeTipo, entidadeId, valor, createdAt, updatedAt)
                  VALUES (?, ?, 'CLIENTE', ?, ?, ?, ?)
                  ON CONFLICT(campoId, entidadeTipo, entidadeId) DO UPDATE SET valor = excluded.valor, updatedAt = excluded.updatedAt`,
            args: [id(), campo.id, empresaId, valor, agora(), agora()],
          });
        }
      }
      const deveNormalizar = campo.escopo !== escopoEsperado
        || (escopoEsperado === "GLOBAL" && (campo.fonteEntidade ?? null) !== fonteEsperada)
        || !campo.chave;
      if (deveNormalizar) {
        await executor.execute({
          sql: `UPDATE BpmCampo SET chave = COALESCE(chave, ?), escopo = ?, fonteEntidade = ?, fonteAtributo = ?, entidadeGlobal = ?, editavel = ?, somenteLeitura = ?, updatedAt = ? WHERE id = ?`,
          args: [`alpha.${chave(nome)}`, escopoEsperado, fonteEsperada, atributoEsperado, escopoEsperado === "GLOBAL" && !fonteEsperada ? "CLIENTE" : null, !fonteEsperada, Boolean(fonteEsperada), agora(), campo.id],
        });
        Object.assign(campo, {
          chave: campo.chave ?? `alpha.${chave(nome)}`,
          escopo: escopoEsperado,
          fonteEntidade: fonteEsperada,
          fonteAtributo: atributoEsperado,
          entidadeGlobal: escopoEsperado === "GLOBAL" && !fonteEsperada ? "CLIENTE" : null,
          editavel: !fonteEsperada,
          somenteLeitura: Boolean(fonteEsperada),
        });
      }
    }
    resolvidos.set(nome, campo);
  }

  let associacoes = 0;
  let configuracoes = 0;
  for (const spec of ETAPAS) {
    const pipeline = pipelines.get(normalizar(spec.pipeline));
    const etapa = etapaPorChave.get(`${pipeline.id}:${normalizar(spec.etapa)}`);
    if (!etapa) throw new Error(`Etapa não encontrada: ${spec.pipeline} / ${spec.etapa}`);
    for (const [ordem, nome] of spec.campos.entries()) {
      const campo = resolvidos.get(nome);
      if (APPLY) {
        await executor.execute({ sql: "INSERT OR IGNORE INTO BpmCampoPipeline (id, campoId, pipelineId, createdAt) VALUES (?, ?, ?, ?)", args: [id(), campo.id, pipeline.id, agora()] });
        await executor.execute({
          sql: `INSERT INTO BpmCampoEtapaConfig (id, campoId, etapaId, visivel, editavel, somenteLeitura, obrigatorio, obrigatorioEntrada, obrigatorioSaida, ordem, grupo, valorPadrao, condicaoVisibilidadeJson, condicaoObrigatoriedadeJson, createdAt, updatedAt)
                VALUES (?, ?, ?, true, ?, ?, ?, false, ?, ?, ?, NULL, NULL, NULL, ?, ?)
                ON CONFLICT(campoId, etapaId) DO UPDATE SET visivel = true, editavel = excluded.editavel, somenteLeitura = excluded.somenteLeitura, obrigatorio = excluded.obrigatorio, obrigatorioSaida = excluded.obrigatorioSaida, ordem = excluded.ordem, grupo = excluded.grupo, updatedAt = excluded.updatedAt`,
          args: [id(), campo.id, etapa.id, !campo.fonteEntidade, Boolean(campo.fonteEntidade), (spec.obrigatorios ?? []).includes(nome), (spec.obrigatoriosSaida ?? []).includes(nome), ordem, spec.grupo, agora(), agora()],
        });
      }
      associacoes++; configuracoes++;
    }
  }
  for (const [nome, opcoes] of Object.entries(OPCOES)) {
    const campo = resolvidos.get(nome);
    if (!campo || !APPLY) continue;
    await executor.execute({ sql: "UPDATE BpmCampo SET opcoesJson = ?, updatedAt = ? WHERE id = ?", args: [JSON.stringify(opcoes), agora(), campo.id] });
    for (const [ordem, rotulo] of opcoes.entries()) {
      await executor.execute({ sql: "INSERT OR IGNORE INTO BpmCampoOpcao (id, campoId, chave, rotulo, ordem, ativo, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, true, ?, ?)", args: [id(), campo.id, chave(rotulo).replaceAll(".", "-"), rotulo, ordem, agora(), agora()] });
    }
  }
  const divergenciasEscopo = [...resolvidos.entries()].filter(([nome, campo]) => {
    const definicao = CAMPOS[nome];
    return campo.escopo !== definicao[1]
      || (definicao[1] === "GLOBAL" && (campo.fonteEntidade ?? null) !== (definicao[2] ?? null));
  }).map(([nome, campo]) => ({ nome, atual: `${campo.escopo}:${campo.fonteEntidade ?? "CUSTOM"}`, esperado: `${CAMPOS[nome][1]}:${CAMPOS[nome][2] ?? "CUSTOM"}`, usos: Number(campo.usos ?? 0) }));
  return { host, modo: APPLY ? "apply" : "dry-run", camposCatalogo: Object.keys(CAMPOS).length, camposCriados: criados, associacoes, configuracoes, divergenciasEscopo, duplicatasAtivas: APPLY ? [] : duplicatasAtivas, duplicatasDesativadas };
}

try {
  if (!APPLY) console.info(JSON.stringify(await executar(client)));
  else {
    const tx = await client.transaction("write");
    try {
      const resumo = await executar(tx);
      const check = await tx.execute("PRAGMA foreign_key_check");
      if (check.rows.length) throw new Error(`Violações de FK: ${check.rows.length}`);
      await tx.commit();
      console.info(JSON.stringify(resumo));
    } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
  }
} finally { client.close(); }
