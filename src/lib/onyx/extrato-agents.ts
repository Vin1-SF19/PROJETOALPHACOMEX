import "server-only";
import {
  createChatSession,
  sendChatMessageStream,
  OnyxError,
} from "@/lib/onyx/client";
import { ocrViaPdf24, isPdf24Configured } from "@/lib/bibble/pdf24-ocr";
import type { TransacaoNormalizada, PaginaComErro } from "@/types/extrato";

const AGENT_ORGANIZADOR_ID = Number(process.env.ONYX_AGENT_ORGANIZADOR_ID ?? "32");

/** Considera "sem texto útil" um trecho com menos de 20 chars reais. */
function textoInsuficiente(texto: string): boolean {
  return texto.trim().length < 20;
}

/**
 * Extrai o texto de cada página do PDF via pdf-parse (nativo, preserva a
 * separação real de página — diferente de cortar o texto corrido por tamanho
 * de caractere, que corta transações ao meio).
 * Se nenhuma página tiver texto útil (PDF de scan/imagem sem camada de texto),
 * tenta OCR real via PDF24 (ocrViaPdf24) e reprocessa o resultado.
 * Retorna [] se não for possível extrair texto de forma alguma.
 */
async function extrairPaginas(buffer: Buffer, fileName: string): Promise<string[]> {
  const { PDFParse } = await import("pdf-parse");

  const extrairViaPdfParse = async (buf: Buffer): Promise<string[]> => {
    const parser = new PDFParse({ data: buf, verbosity: 0 });
    const result = await parser.getText();
    await parser.destroy();
    return result.pages
      .map((p: { num: number; text: string }) => p.text.trim())
      .filter((texto: string) => !textoInsuficiente(texto));
  };

  let paginasUteis = await extrairViaPdfParse(buffer);
  console.log(`[extrato-agents] pdf-parse: páginas com texto útil = ${paginasUteis.length}`);

  if (paginasUteis.length === 0) {
    if (!isPdf24Configured()) {
      console.warn("[extrato-agents] nenhuma página com texto e PDF24 não configurado — sem fallback disponível.");
      return [];
    }

    try {
      console.log(`[extrato-agents] nenhuma página com texto útil — acionando OCR via PDF24 para ${fileName}...`);
      const bufferOcr = await ocrViaPdf24(buffer, fileName);
      paginasUteis = await extrairViaPdfParse(bufferOcr);
      console.log(`[extrato-agents] após OCR: páginas com texto útil = ${paginasUteis.length}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[extrato-agents] falha no fallback PDF24-OCR: ${msg}`);
      return [];
    }
  }

  return paginasUteis;
}

const PROMPT_ORGANIZACAO = (textoPagina: string) => `Abaixo está o texto de UMA PÁGINA de um extrato bancário em PDF (extraído via OCR/parsing local).
Identifique TODAS as movimentações bancárias encontradas nesta página e organize-as em um JSON válido.

O JSON deve ser um array onde cada objeto tem exatamente os campos:
- data: string no formato DD/MM/YYYY (complete o ano se estiver abreviado, usando o ano atual como referência)
- descricao: string em maiúsculas, sem espaços extras
- valor: número (float), negativo para débitos/saídas, positivo para créditos/entradas

Regras:
- Esta é apenas UMA PÁGINA do extrato — pode começar/terminar no meio de uma movimentação truncada; ignore linhas incompletas que não tenham data+descrição+valor claros.
- A descricao deve ser a linha COMPLETA de identificação da movimentação, exatamente como está no texto — nunca corte ou abrevie o nome do favorecido/histórico no meio de uma palavra.
- Não inclua linhas de saldo, cabeçalhos, totais ou resumos.
- Remova entradas com valor zero ou descrição vazia.
- Não invente dados — preserve exatamente o que veio do extrato.
- Cada movimentação aparece SOMENTE UMA VEZ no JSON de saída — não repita a mesma linha.
- Se não houver nenhuma movimentação nesta página, retorne um array vazio [].
- Retorne APENAS o JSON puro, sem markdown, sem blocos de código, sem explicações.

TEXTO DA PÁGINA:
${textoPagina}`;

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
 * Envia o texto de UMA página do extrato para o Agente Organizador e devolve
 * as transações encontradas nela. O modelo do agente (qwen3) por vezes aborta
 * o reasoning sem responder — até 2 tentativas em sessões novas antes de
 * desistir desta página.
 */
export async function organizarPagina(textoPagina: string, indicePagina: number): Promise<TransacaoNormalizada[]> {
  const MAX_TENTATIVAS = 2;
  let textoOrganizado = "";

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const sessao = await createChatSession(AGENT_ORGANIZADOR_ID, `Organização de Extrato — página ${indicePagina + 1}`);
    const stream = await sendChatMessageStream({
      chatSessionId: sessao.chat_session_id,
      message: PROMPT_ORGANIZACAO(textoPagina),
      additionalContext: CTX_SEM_TOOLS,
      maxTokens: 8192,
    });
    textoOrganizado = await coletarResposta(stream, `agente-organizador-pagina${indicePagina + 1}-tentativa${tentativa}`);

    if (textoOrganizado) break;
    console.warn(`[extrato-agents] página ${indicePagina + 1}, tentativa ${tentativa} sem resposta do agente organizador.`);
  }

  if (!textoOrganizado) {
    throw new OnyxError(
      `O agente organizador não conseguiu processar a página ${indicePagina + 1} do extrato após múltiplas tentativas.`,
      502,
    );
  }

  try {
    return parseTransacoes(textoOrganizado);
  } catch {
    throw new OnyxError(
      `Não foi possível interpretar o JSON retornado pelo agente organizador (página ${indicePagina + 1}).`,
      502,
    );
  }
}

/**
 * Processa um PDF de extrato bancário: extração de texto por página real
 * (pdf-parse, com fallback OCR via PDF24 se o PDF não tiver texto nativo) +
 * Agente Onyx único.
 * Cada página vira UMA chamada ao Agente Organizador de Extratos Bancários
 * (ID 32) — evita cortar uma transação no meio (o que acontecia ao dividir o
 * texto corrido por tamanho de caractere). Os resultados de todas as páginas
 * são agregados no final, com deduplicação de segurança.
 *
 * Falha em UMA página NÃO aborta o processamento das demais — a página que
 * falhar (mesmo após as tentativas internas de `organizarPagina`) entra em
 * `paginasComErro` (com o texto dela, pra permitir reprocessar depois sem
 * reler o PDF) e o loop continua. Só lança erro fatal se não houver NENHUMA
 * página com texto extraível (nada para processar).
 */
export async function processarExtratoPorAgentes(
  pdfBlob: Blob,
  nomeArquivo: string,
): Promise<{ transacoes: TransacaoNormalizada[]; paginasComErro: PaginaComErro[] }> {
  // 1. Extrai o texto de cada página real do PDF
  const buffer = Buffer.from(await pdfBlob.arrayBuffer());
  const paginas = await extrairPaginas(buffer, nomeArquivo);

  if (paginas.length === 0) {
    throw new OnyxError(
      "Não foi possível extrair texto do PDF. O arquivo pode estar corrompido, protegido, ou ser um PDF de imagem sem camada de texto (scan sem OCR).",
      422,
    );
  }

  console.log(`[extrato-agents] ${paginas.length} página(s) com texto útil — enviando ao Agente Organizador`);

  // 2. Agente Organizador — 1 chamada por página; falha pontual não aborta as demais
  const transacoesBrutas: TransacaoNormalizada[] = [];
  const paginasComErro: PaginaComErro[] = [];
  for (let i = 0; i < paginas.length; i++) {
    try {
      const daPagina = await organizarPagina(paginas[i], i);
      console.log(`[extrato-agents] página ${i + 1}/${paginas.length}: ${daPagina.length} transação(ões)`);
      transacoesBrutas.push(...daPagina);
    } catch (err) {
      const motivo = err instanceof Error ? err.message : String(err);
      console.warn(`[extrato-agents] página ${i + 1}/${paginas.length} falhou, continuando: ${motivo}`);
      paginasComErro.push({ pagina: i + 1, texto: paginas[i], motivo });
    }
  }

  // 3. Deduplicação de segurança — não deve disparar na prática (páginas não
  // se sobrepõem), mas é barato manter como salvaguarda.
  const vistos = new Set<string>();
  const transacoes = transacoesBrutas.filter((t) => {
    const chave = `${t.data}|${t.descricao}|${t.valor}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  const duplicatasRemovidas = transacoesBrutas.length - transacoes.length;
  if (duplicatasRemovidas > 0) {
    console.log(`[extrato-agents] ${duplicatasRemovidas} duplicata(s) removida(s)`);
  }

  return { transacoes, paginasComErro };
}
