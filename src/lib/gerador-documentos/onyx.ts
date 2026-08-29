import "server-only";
import {
  createChatSession,
  sendChatMessageStream,
  OnyxError,
} from "@/lib/onyx/client";
import { IdentificacaoTemplateSchema, type IdentificacaoTemplate } from "./schemas";

// persona_id 0 = "Default AI" do Onyx — mesmo modo usado pelo Bibble quando
// não há agente dedicado configurado para esta tarefa (ver /api/onyx/chat).
const PERSONA_ID_PADRAO = 0;

interface OnyxPkt {
  obj?: { type: string; content?: string; reasoning?: string };
}

/** Lê o stream NDJSON do Onyx e retorna só o texto de resposta final (sem reasoning). */
async function coletarRespostaTexto(response: Response, label: string): Promise<string> {
  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new OnyxError(body || `Onyx respondeu ${response.status}`, response.status);
  }

  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let resposta = "";
  let encerrado = false;

  const processar = (linha: string) => {
    const t = linha.trim();
    if (!t) return;
    try {
      const pkt = JSON.parse(t) as OnyxPkt;
      const obj = pkt.obj;
      if (!obj) return;
      if (obj.type === "message_delta" && obj.content) resposta += obj.content;
      if (obj.type === "stop") encerrado = true;
    } catch {
      /* linha parcial — ignorar */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const linhas = buf.split("\n");
    buf = linhas.pop() ?? "";
    for (const linha of linhas) processar(linha);
    if (encerrado) break;
  }
  if (buf.trim()) processar(buf);

  console.log(`[gerador-documentos][onyx][${label}] resultado: ${resposta.length} chars`);
  return resposta.trim();
}

const CTX_REESCRITA_CLAUSULA =
  "INSTRUÇÃO DO SISTEMA: Você está reescrevendo APENAS UMA cláusula de um documento contratual. " +
  "Responda DIRETAMENTE com o texto final da cláusula reescrita — sem explicações, sem markdown, " +
  "sem aspas envolvendo o texto, sem repetir o título da cláusula. NÃO use ferramentas. " +
  "Preserve o tom formal/contratual do texto original.";

function montarPrompt(params: {
  contextoContrato: string;
  tituloClasula: string;
  textoAtual: string;
  instrucao: string;
}): string {
  return [
    "Contexto completo do contrato (para você entender o documento como um todo):",
    "---",
    params.contextoContrato,
    "---",
    "",
    `Cláusula a reescrever: "${params.tituloClasula}"`,
    "Texto atual desta cláusula:",
    "---",
    params.textoAtual,
    "---",
    "",
    `Alteração solicitada pelo usuário: ${params.instrucao}`,
    "",
    "Retorne exclusivamente o novo texto desta cláusula, já reescrito conforme a alteração solicitada. " +
      "Não inclua nenhuma outra cláusula, não repita o contexto do contrato.",
  ].join("\n");
}

/**
 * Reescreve o texto de UMA cláusula via IA padrão do painel (Onyx), a partir
 * do contexto completo do contrato + texto atual + instrução do usuário.
 * Nunca altera outras cláusulas — a chamada só envia/recebe o texto desta.
 */
export async function reescreverClasulaViaIA(params: {
  contextoContrato: string;
  tituloClasula: string;
  textoAtual: string;
  instrucao: string;
  userToken?: string | null;
}): Promise<string> {
  const sessao = await createChatSession(
    PERSONA_ID_PADRAO,
    `Gerador de Documentos — reescrita: ${params.tituloClasula}`,
    params.userToken,
  );

  const prompt = montarPrompt(params);
  const stream = await sendChatMessageStream({
    chatSessionId: sessao.chat_session_id,
    message: prompt,
    additionalContext: CTX_REESCRITA_CLAUSULA,
    maxTokens: 4096,
    userToken: params.userToken,
  });

  const texto = await coletarRespostaTexto(stream, params.tituloClasula.slice(0, 40));
  if (!texto) {
    throw new OnyxError("A IA não retornou nenhum texto para esta cláusula.", 502);
  }
  return texto;
}

const CTX_IDENTIFICACAO_TEMPLATE =
  "INSTRUÇÃO DO SISTEMA: Você está analisando o texto de um documento contratual para transformá-lo " +
  "em um TEMPLATE reutilizável. Responda EXCLUSIVAMENTE com um objeto JSON válido, sem markdown, " +
  "sem crases, sem explicações antes ou depois — apenas o JSON puro. NÃO use ferramentas.";

function montarPromptIdentificacao(textoDocumento: string): string {
  return [
    "Documento a analisar:",
    "---",
    textoDocumento,
    "---",
    "",
    "Tarefas:",
    "1. Divida o documento em CLÁUSULAS: blocos de texto com um título/assunto claro (ex: \"Objeto\", " +
      "\"Prazo\", \"Valor e Forma de Pagamento\", \"Rescisão\"). Preserve a ordem original.",
    "2. Dentro do texto, identifique DADOS VARIÁVEIS que mudariam a cada uso do documento — nomes de " +
      "pessoa ou empresa, CPF/CNPJ, endereços, valores monetários, datas, prazos numéricos, etc. " +
      "NÃO trate texto fixo/padrão do contrato como variável.",
    "3. Para cada variável encontrada, escolha um nome técnico válido (regex " +
      "^[a-zA-Z_][a-zA-Z0-9_]*$ — apenas letras sem acento, números e underscore, começando com letra " +
      "ou underscore, sem espaços), um rótulo legível para humanos, e um tipo dentre: " +
      "\"texto\", \"numero\", \"moeda\", \"data\", \"booleano\".",
    "4. No texto de CADA cláusula, substitua a ocorrência do dado variável pelo placeholder " +
      "{{nome_da_variavel}} (usando o mesmo nome técnico escolhido). Se a mesma variável aparecer em " +
      "mais de uma cláusula, use o mesmo nome/placeholder em todas.",
    "5. Se não for possível identificar nenhuma cláusula com conteúdo real, ainda assim retorne o " +
      "documento inteiro como uma única cláusula (não retorne \"clausulas\" vazio).",
    "",
    "Responda EXATAMENTE neste formato JSON (sem nenhum texto fora do objeto):",
    "{",
    '  "variaveis": [',
    '    { "nome": "nome_cliente", "label": "Nome do Cliente", "tipo": "texto", "obrigatorio": true }',
    "  ],",
    '  "clausulas": [',
    '    { "titulo": "Objeto", "conteudo": "O presente contrato tem como objeto..." }',
    "  ]",
    "}",
  ].join("\n");
}

/** Extrai o primeiro bloco JSON de uma resposta que pode vir cercada de texto/markdown, apesar da instrução. */
function extrairJson(texto: string): unknown {
  const semCrases = texto.replace(/```json|```/gi, "").trim();
  const inicio = semCrases.indexOf("{");
  const fim = semCrases.lastIndexOf("}");
  if (inicio === -1 || fim === -1 || fim < inicio) {
    throw new OnyxError("A IA não retornou um JSON reconhecível.", 502);
  }
  try {
    return JSON.parse(semCrases.slice(inicio, fim + 1));
  } catch {
    throw new OnyxError("A IA retornou um JSON inválido.", 502);
  }
}

/**
 * Analisa o texto de um documento enviado por upload e identifica variáveis +
 * cláusulas via IA padrão do painel (Onyx), para criação automática de
 * template (RM-2026-93645F). Lança OnyxError se a IA não retornar uma
 * estrutura válida — nunca deve resultar em template vazio/quebrado.
 */
export async function identificarVariaveisEClasulasViaIA(
  textoDocumento: string,
  userToken?: string | null,
): Promise<IdentificacaoTemplate> {
  const sessao = await createChatSession(
    PERSONA_ID_PADRAO,
    "Gerador de Documentos — identificação de template via upload",
    userToken,
  );

  const stream = await sendChatMessageStream({
    chatSessionId: sessao.chat_session_id,
    message: montarPromptIdentificacao(textoDocumento),
    additionalContext: CTX_IDENTIFICACAO_TEMPLATE,
    maxTokens: 8192,
    userToken,
  });

  const respostaTexto = await coletarRespostaTexto(stream, "identificacao-template");
  if (!respostaTexto) {
    throw new OnyxError("A IA não retornou nenhuma análise para este documento.", 502);
  }

  const json = extrairJson(respostaTexto);
  const parsed = IdentificacaoTemplateSchema.safeParse(json);
  if (!parsed.success) {
    throw new OnyxError("A IA não conseguiu estruturar variáveis e cláusulas a partir deste documento.", 502);
  }

  const nomesVariaveis = new Set(parsed.data.variaveis.map((v) => v.nome));
  if (nomesVariaveis.size !== parsed.data.variaveis.length) {
    throw new OnyxError("A IA identificou variáveis com nomes duplicados.", 502);
  }

  return parsed.data;
}
