import "server-only";
import {
  createChatSession,
  sendChatMessageStream,
  OnyxError,
} from "@/lib/onyx/client";
import { extractTextFromBuffer } from "@/lib/bibble/tika";
import type { TransacaoNormalizada } from "@/types/extrato";

const AGENT_EXTRATOR_ID = Number(process.env.ONYX_AGENT_EXTRATOR_ID ?? "25");
const AGENT_NORMALIZADOR_ID = Number(process.env.ONYX_AGENT_NORMALIZADOR_ID ?? "26");

const PROMPT_EXTRACAO = (textoExtrato: string) => `Abaixo está o texto extraído de um extrato bancário em PDF.
Extraia TODAS as movimentações bancárias encontradas e retorne SOMENTE um JSON válido.
O JSON deve ser um array onde cada objeto tem exatamente os campos: data (string DD/MM/YYYY ou DD/MM/AA), descricao (string), valor (número — negativo para débitos/saídas, positivo para créditos/entradas).
Não inclua linhas de saldo, cabeçalhos, totais ou resumos.
Retorne APENAS o JSON puro, sem markdown, sem blocos de código, sem explicações.

TEXTO DO EXTRATO:
${textoExtrato}`;

const PROMPT_NORMALIZACAO = (jsonBruto: string) => `Você receberá um JSON com transações brutas de extrato bancário.
Normalize os dados seguindo estas regras:
- datas: padronize para DD/MM/YYYY (complete o ano se estiver abreviado usando o ano atual)
- valores: converta para número (float), negativo para débitos, positivo para créditos
- descrições: remova espaços extras, mantenha em maiúsculas
- remova entradas com valor zero ou descrição vazia
- não invente dados — preserve exatamente o que veio do extrato

Retorne APENAS o JSON final normalizado no formato [{data, descricao, valor}], sem markdown.

JSON de entrada:
${jsonBruto}`;

interface OnyxPkt {
  obj?: {
    type: string;
    content?: string;
    reasoning?: string;
    tool_name?: string;
    tool_result?: string;
    sub_question?: string;
    level?: number;
    level_question_num?: number;
  };
}

/** Lê o stream NDJSON do Onyx e retorna o texto completo da resposta do agente. */
async function coletarResposta(response: Response, label: string): Promise<string> {
  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new OnyxError(body || `Onyx respondeu ${response.status}`, response.status);
  }

  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  // Coleta separada: resposta final do agente vs saída de tools
  let respostaFinal = "";
  let saidaTools = "";
  let encerrado = false;

  const processar = (linha: string) => {
    const t = linha.trim();
    if (!t) return;
    try {
      const pkt = JSON.parse(t) as OnyxPkt;
      const obj = pkt.obj;
      if (!obj) return;
      const tipo = obj.type;

      console.log(`[extrato-agents][${label}] packet: ${tipo}`);

      switch (tipo) {
        // Resposta textual principal do agente
        case "message_delta":
          if (obj.content) respostaFinal += obj.content;
          break;

        // Saída de tool (Code Interpreter, search, etc.)
        // Capturamos como fallback caso o agente responda só via tool
        case "tool_response":
          if (obj.tool_result) saidaTools += obj.tool_result;
          break;

        // Sub-perguntas do agente (modo agentic)
        case "sub_question_piece":
          if (obj.content) saidaTools += obj.content;
          break;

        case "stop":
          encerrado = true;
          break;

        default:
          break;
      }
    } catch { /* linha parcial — ignorar */ }
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

  // Prefere a resposta final do agente; cai na saída de tools como fallback
  const resultado = respostaFinal.trim() || saidaTools.trim();
  console.log(`[extrato-agents][${label}] resultado (${resultado.length} chars):`, resultado.slice(0, 300));
  return resultado;
}

/** Extrai o JSON da resposta do agente, removendo blocos markdown se presentes. */
function extrairJSON(texto: string): string {
  const match = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  const inicio = texto.indexOf("[");
  const fim = texto.lastIndexOf("]");
  if (inicio !== -1 && fim !== -1 && fim > inicio) {
    return texto.slice(inicio, fim + 1);
  }
  return texto;
}

const CTX_SEM_TOOLS =
  "INSTRUÇÃO DO SISTEMA: Responda DIRETAMENTE com o JSON solicitado. NÃO use ferramentas (Python, search, open_url). NÃO faça buscas. Apenas processe o conteúdo recebido e retorne o JSON.";

/**
 * Orquestra os dois agentes Onyx para processar um PDF de extrato bancário.
 * Agente 1 (ID 25): recebe o texto extraído localmente via Tika, identifica transações.
 * Agente 2 (ID 26): normaliza o JSON bruto retornado pelo Agente 1.
 */
export async function processarExtratoPorAgentes(
  pdfBlob: Blob,
  nomeArquivo: string,
): Promise<TransacaoNormalizada[]> {
  // 1. Extrai texto do PDF localmente via Tika (com fallback pdf-parse)
  const buffer = Buffer.from(await pdfBlob.arrayBuffer());
  const { text: textoExtrato, source } = await extractTextFromBuffer(
    buffer,
    "application/pdf",
    nomeArquivo,
  );

  if (!textoExtrato) {
    throw new OnyxError(
      "Não foi possível extrair texto do PDF. Verifique se o arquivo não está corrompido ou protegido.",
      422,
    );
  }

  console.log(`[extrato-agents] PDF extraído via ${source} — ${textoExtrato.length} chars`);

  // 2. Agente 1 — extração de transações (recebe o texto, não o arquivo)
  const sessao1 = await createChatSession(AGENT_EXTRATOR_ID, "Extração de Extrato");
  const stream1 = await sendChatMessageStream({
    chatSessionId: sessao1.chat_session_id,
    message: PROMPT_EXTRACAO(textoExtrato),
    additionalContext: CTX_SEM_TOOLS,
  });
  const textoExtracao = await coletarResposta(stream1, "agente1-extracao");

  if (!textoExtracao) {
    throw new OnyxError("Agente de extração não retornou dados.", 502);
  }

  // 3. Agente 2 — normalização
  const sessao2 = await createChatSession(AGENT_NORMALIZADOR_ID, "Normalização de Extrato");
  const stream2 = await sendChatMessageStream({
    chatSessionId: sessao2.chat_session_id,
    message: PROMPT_NORMALIZACAO(textoExtracao),
    additionalContext: CTX_SEM_TOOLS,
  });
  const textoNormalizacao = await coletarResposta(stream2, "agente2-normalizacao");

  if (!textoNormalizacao) {
    throw new OnyxError("Agente de normalização não retornou dados.", 502);
  }

  // 4. Parse do JSON final
  let transacoes: TransacaoNormalizada[];
  try {
    const jsonLimpo = extrairJSON(textoNormalizacao);
    const parsed = JSON.parse(jsonLimpo) as unknown[];
    transacoes = parsed
      .filter(
        (item): item is { data: string; descricao: string; valor: number } =>
          typeof item === "object" &&
          item !== null &&
          "data" in item &&
          "descricao" in item &&
          "valor" in item,
      )
      .map((item) => ({
        data: String(item.data ?? "").trim(),
        descricao: String(item.descricao ?? "").trim().toUpperCase(),
        valor: Number(item.valor) || 0,
      }))
      .filter((t) => t.descricao && t.valor !== 0);
  } catch {
    throw new OnyxError(
      "Não foi possível interpretar o JSON retornado pelo agente de normalização.",
      502,
    );
  }

  return transacoes;
}
