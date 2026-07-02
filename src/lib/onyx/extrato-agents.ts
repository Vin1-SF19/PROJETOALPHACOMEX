import "server-only";
import {
  createChatSession,
  sendChatMessageStream,
  OnyxError,
} from "@/lib/onyx/client";
import { extractTextFromBuffer } from "@/lib/bibble/tika";
import type { TransacaoNormalizada } from "@/types/extrato";

const AGENT_ORGANIZADOR_ID = Number(process.env.ONYX_AGENT_ORGANIZADOR_ID ?? "32");

// O modelo do agente (qwen3) aborta o reasoning sem responder quando recebe
// o texto inteiro de extratos longos de uma vez (~37k chars já é demais).
// Chunk menor também reduz erro de leitura (descrição truncada/incompleta)
// em páginas muito densas — trecho mais curto = menos chance de o modelo
// "perder o fio" no meio do texto.
const TAMANHO_MAX_CHUNK = 3500;

/**
 * Divide o texto do extrato em pedaços processáveis pelo agente.
 * Preferência: quebrar por página (form-feed \f, que o Tika preserva entre
 * páginas de PDF). Se um "pedaço de página" ainda for maior que o limite
 * (página muito densa) ou não houver form-feed nenhum, quebra por tamanho de
 * caracteres, tentando não cortar no meio de uma linha.
 */
function dividirEmChunks(texto: string, tamanhoMax = TAMANHO_MAX_CHUNK): string[] {
  const paginas = texto.split("\f").map((p) => p.trim()).filter(Boolean);
  const blocos = paginas.length > 1 ? paginas : [texto];

  const chunks: string[] = [];
  for (const bloco of blocos) {
    if (bloco.length <= tamanhoMax) {
      chunks.push(bloco);
      continue;
    }
    // Bloco denso demais — quebra por linhas, agrupando até o limite
    const linhas = bloco.split("\n");
    let atual = "";
    for (const linha of linhas) {
      if (atual.length + linha.length + 1 > tamanhoMax && atual) {
        chunks.push(atual);
        atual = linha;
      } else {
        atual = atual ? `${atual}\n${linha}` : linha;
      }
    }
    if (atual) chunks.push(atual);
  }
  return chunks;
}

const PROMPT_ORGANIZACAO = (textoExtrato: string) => `Abaixo está um trecho do texto extraído via OCR (Apache Tika) de um extrato bancário em PDF.
Identifique TODAS as movimentações bancárias encontradas neste trecho e organize-as em um JSON válido.

O JSON deve ser um array onde cada objeto tem exatamente os campos:
- data: string no formato DD/MM/YYYY (complete o ano se estiver abreviado, usando o ano atual como referência)
- descricao: string em maiúsculas, sem espaços extras
- valor: número (float), negativo para débitos/saídas, positivo para créditos/entradas

Regras:
- Este é apenas um TRECHO do extrato — pode começar/terminar no meio de uma movimentação truncada; ignore linhas incompletas que não tenham data+descrição+valor claros.
- A descricao deve ser a linha COMPLETA de identificação da movimentação, exatamente como está no texto — nunca corte ou abrevie o nome do favorecido/histórico no meio de uma palavra.
- Não inclua linhas de saldo, cabeçalhos, totais ou resumos.
- Remova entradas com valor zero ou descrição vazia.
- Não invente dados — preserve exatamente o que veio do extrato.
- Cada movimentação aparece SOMENTE UMA VEZ no JSON de saída — não repita a mesma linha.
- Se não houver nenhuma movimentação neste trecho, retorne um array vazio [].
- Retorne APENAS o JSON puro, sem markdown, sem blocos de código, sem explicações.

TRECHO DO EXTRATO:
${textoExtrato}`;

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

/** Converte o JSON bruto devolvido pelo agente em transações validadas. */
function parseTransacoes(textoResposta: string): TransacaoNormalizada[] {
  const jsonLimpo = extrairJSON(textoResposta);
  const parsed = JSON.parse(jsonLimpo) as unknown[];
  return parsed
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
}

/**
 * Envia um trecho do extrato para o Agente Organizador e devolve as transações
 * encontradas nele. O modelo do agente (qwen3) por vezes aborta o reasoning sem
 * responder — até 2 tentativas em sessões novas antes de desistir deste trecho.
 */
async function organizarChunk(chunk: string, indice: number): Promise<TransacaoNormalizada[]> {
  const MAX_TENTATIVAS = 2;
  let textoOrganizado = "";

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const sessao = await createChatSession(AGENT_ORGANIZADOR_ID, `Organização de Extrato — trecho ${indice + 1}`);
    const stream = await sendChatMessageStream({
      chatSessionId: sessao.chat_session_id,
      message: PROMPT_ORGANIZACAO(chunk),
      additionalContext: CTX_SEM_TOOLS,
      maxTokens: 8192,
    });
    textoOrganizado = await coletarResposta(stream, `agente-organizador-trecho${indice + 1}-tentativa${tentativa}`);

    if (textoOrganizado) break;
    console.warn(`[extrato-agents] trecho ${indice + 1}, tentativa ${tentativa} sem resposta do agente organizador.`);
  }

  if (!textoOrganizado) {
    throw new OnyxError(
      `O agente organizador não conseguiu processar o trecho ${indice + 1} do extrato após múltiplas tentativas.`,
      502,
    );
  }

  try {
    return parseTransacoes(textoOrganizado);
  } catch {
    throw new OnyxError(
      `Não foi possível interpretar o JSON retornado pelo agente organizador (trecho ${indice + 1}).`,
      502,
    );
  }
}

/**
 * Processa um PDF de extrato bancário: OCR puro via Tika + Agente Onyx único.
 * Tika (local): extrai o texto bruto do PDF — sem IA.
 * O texto é dividido em trechos menores (por página, ou por tamanho quando
 * necessário) porque o modelo do agente não processa extratos inteiros de
 * uma vez de forma confiável. Cada trecho é enviado ao Agente Organizador de
 * Extratos Bancários (ID 32), que devolve as transações daquele trecho; os
 * resultados são agregados no final.
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

  // Texto muito curto (ex: só marcadores de página "-- 1 of N --") indica que
  // o PDF não tem camada de texto extraível — provavelmente é um PDF de
  // imagem/scan sem OCR aplicado, ou foi gerado a partir de um recorte que
  // perdeu o texto original.
  if (!textoExtrato || textoExtrato.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "").trim().length < 20) {
    throw new OnyxError(
      "Não foi possível extrair texto do PDF. O arquivo pode estar corrompido, protegido, ou ser um PDF de imagem sem camada de texto (scan sem OCR).",
      422,
    );
  }

  console.log(`[extrato-agents] PDF extraído via ${source} — ${textoExtrato.length} chars`);

  // 2. Divide em trechos processáveis e envia cada um ao Agente Organizador
  const chunks = dividirEmChunks(textoExtrato);
  console.log(`[extrato-agents] texto dividido em ${chunks.length} trecho(s)`);

  const transacoesBrutas: TransacaoNormalizada[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const doTrecho = await organizarChunk(chunks[i], i);
    console.log(`[extrato-agents] trecho ${i + 1}/${chunks.length}: ${doTrecho.length} transação(ões)`);
    transacoesBrutas.push(...doTrecho);
  }

  // 3. Remove duplicatas: a sobreposição entre o fim de um trecho e o início
  // do próximo (mesma linha do extrato cortada ao meio) pode fazer o mesmo
  // lançamento aparecer em 2 chunks. Uma transação idêntica (mesma data +
  // descrição + valor) não se repete de verdade num extrato bancário real.
  const vistos = new Set<string>();
  const transacoes = transacoesBrutas.filter((t) => {
    const chave = `${t.data}|${t.descricao}|${t.valor}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  const duplicatasRemovidas = transacoesBrutas.length - transacoes.length;
  if (duplicatasRemovidas > 0) {
    console.log(`[extrato-agents] ${duplicatasRemovidas} duplicata(s) removida(s) (sobreposição entre trechos)`);
  }

  return transacoes;
}
