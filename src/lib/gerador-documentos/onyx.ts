import "server-only";
import {
  createChatSession,
  sendChatMessageStream,
  OnyxError,
} from "@/lib/onyx/client";

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
