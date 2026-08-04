import "server-only";
import { pdfjsWorkerReady } from "@/lib/bibble/pdfjs-polyfill";
import {
  createChatSession,
  sendChatMessageStream,
  OnyxError,
} from "@/lib/onyx/client";
import { ocrViaPdf24, isPdf24Configured } from "@/lib/bibble/pdf24-ocr";
import type { TransacaoNormalizada, PaginaComErro } from "@/types/extrato";
import { transacaoOnyxSchema, transacoesOnyxArraySchema } from "@/lib/validations/extrato";
import { detectarParserExtrato } from "@/lib/extrato/parsers";

const AGENT_ORGANIZADOR_ID = Number(process.env.ONYX_AGENT_ORGANIZADOR_ID ?? "32");

/** Considera "sem texto útil" um trecho com menos de 20 chars reais. */
function textoInsuficiente(texto: string): boolean {
  return texto.trim().length < 20;
}

function isDocx(fileName: string): boolean {
  return /\.docx$/i.test(fileName.trim());
}

/**
 * Extrai o texto de um .docx via mammoth. Documentos Word não têm o conceito
 * de "página" real (o layout é reflow, não paginado como PDF) — por isso o
 * documento inteiro é tratado como UMA única "página" para o Agente
 * Organizador, em vez de dividir artificialmente.
 */
async function extrairDocx(buffer: Buffer): Promise<string[]> {
  const mammoth = await import("mammoth");
  const { value: texto } = await mammoth.extractRawText({ buffer });
  return textoInsuficiente(texto) ? [] : [texto.trim()];
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
  if (isDocx(fileName)) {
    const paginasDocx = await extrairDocx(buffer);
    console.log(`[extrato-agents] mammoth (.docx): texto útil = ${paginasDocx.length > 0}`);
    return paginasDocx;
  }

  await pdfjsWorkerReady;
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

const PROMPT_ORGANIZACAO = (textoPagina: string) => `Abaixo está o texto de UMA PÁGINA de um extrato bancário em PDF (extraído via OCR/parsing local — o texto pode ter ruído de reconhecimento: letras trocadas, palavras coladas, ou colunas de uma tabela linearizadas em texto corrido).
Identifique TODAS as movimentações bancárias encontradas nesta página e organize-as em um JSON válido.

O JSON deve ser um array onde cada objeto tem exatamente os campos:
- data: string no formato DD/MM/YYYY (complete o ano se estiver abreviado, usando o ano atual como referência)
- descricao: string em maiúsculas, sem espaços extras
- valor: número (float), negativo para débitos/saídas, positivo para créditos/entradas

Regras:
- Esta é apenas UMA PÁGINA do extrato — pode começar/terminar no meio de uma movimentação truncada; ignore linhas incompletas que não tenham descrição+valor claros.
- CRÍTICO — DATA AGRUPADA POR DIA: muitos extratos bancários (ex: Bradesco Net Empresa) mostram a data SOMENTE na primeira linha de cada dia — todas as movimentações seguintes daquele mesmo dia NÃO repetem a data na tabela, ficando com a célula de data vazia. Quando você encontrar uma linha de movimentação SEM data explícita, USE a última data válida encontrada nas linhas anteriores (herde a data de cima) — NÃO descarte a linha e NÃO deixe o campo "data" vazio só porque a data não veio repetida naquela linha específica.
- A descricao deve ser a linha COMPLETA de identificação da movimentação, exatamente como está no texto — nunca corte ou abrevie o nome do favorecido/histórico no meio de uma palavra. Se o texto de OCR estiver visivelmente corrompido/ilegível numa palavra (ex: letras trocadas tipo "MED ETEIDO DIST" em vez de "TED-TRANSF"), preserve a descrição como veio — não tente "corrigir" ou adivinhar o texto original, apenas não invente palavras que não estão lá.
- CRÍTICO — NUNCA inclua linhas de "SALDO DO DIA", "SALDO ANTERIOR", "SALDO ATUAL", cabeçalhos, totais ou resumos como se fossem movimentações. Uma linha de saldo não é uma transação, mesmo que tenha data e valor. Se a linha contém a palavra "SALDO" e não descreve uma operação real (PIX, TED, compra, pagamento, transferência, etc.), DESCARTE-A.
- CRÍTICO — CADA LINHA DE MOVIMENTAÇÃO TEM EXATAMENTE UM VALOR (crédito OU débito, nunca os dois). Se você identificar múltiplos números em uma linha (ex: um valor de crédito/débito E um valor de saldo acumulado ao final), o valor da movimentação é o PRIMEIRO número monetário após a descrição — o ÚLTIMO número da linha costuma ser o SALDO ACUMULADO da conta após aquela movimentação, NÃO o valor da transação. Nunca confunda saldo acumulado com o valor da movimentação.
- Remova entradas com valor zero ou descrição vazia.
- Não invente dados — preserve exatamente o que veio do extrato.
- Cada movimentação aparece SOMENTE UMA VEZ no JSON de saída — não repita a mesma linha.
- Se não houver nenhuma movimentação nesta página, retorne um array vazio [].
- Retorne APENAS o JSON puro, sem markdown, sem blocos de código, sem explicações.

Exemplo de entrada e saída esperada (note a data agrupada por dia e o saldo acumulado no fim de cada linha):
ENTRADA:
"15/03/2026 PIX RECEBIDO JOAO DA SILVA 1.250,00 8.430,50
Saldo do dia: R$ 8.430,50
PAGAMENTO BOLETO ENERGISA -340,22 8.090,28"

SAÍDA:
[{"data":"15/03/2026","descricao":"PIX RECEBIDO JOAO DA SILVA","valor":1250.00},{"data":"15/03/2026","descricao":"PAGAMENTO BOLETO ENERGISA","valor":-340.22}]

(Note que: a linha "Saldo do dia" foi OMITIDA; a segunda movimentação HERDOU a data 15/03/2026 mesmo sem repeti-la no texto; o número "8.430,50"/"8.090,28" ao final de cada linha é o SALDO acumulado, não o valor da movimentação — foi corretamente ignorado.)

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
  // Não logar o conteúdo (dados financeiros reais do cliente) — só o tamanho.
  console.log(`[extrato-agents][${label}] resultado: ${resultado.length} chars`);
  return resultado;
}

/**
 * Extrai o array de transações da resposta do agente, removendo blocos markdown
 * se presentes. O agente às vezes ignora o formato pedido no prompt e devolve um
 * OBJETO na raiz (ex: `{"bank":..., "transactions":[...]}`) em vez do array puro
 * solicitado — provavelmente por causa de uma instrução de sistema própria da
 * persona configurada na plataforma Onyx, fora do controle deste código. Por
 * isso extraímos o array de dentro de qualquer objeto que o contenha, em vez de
 * assumir que a raiz já é o array.
 */
function extrairJSON(texto: string): string {
  const match = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  const bruto = match ? match[1].trim() : texto;

  try {
    const parsed = JSON.parse(bruto) as unknown;
    if (Array.isArray(parsed)) return bruto;
    if (parsed && typeof parsed === "object") {
      // Formato alternativo observado: {bank, account, ..., transactions:[...]}
      const possivelArray = (parsed as Record<string, unknown>).transactions
        ?? (parsed as Record<string, unknown>).movimentacoes
        ?? (parsed as Record<string, unknown>).data;
      if (Array.isArray(possivelArray)) return JSON.stringify(possivelArray);
    }
  } catch {
    // bruto não é JSON válido sozinho — cai no fallback de recorte por colchetes abaixo
  }

  const inicio = bruto.indexOf("[");
  const fim = bruto.lastIndexOf("]");
  if (inicio !== -1 && fim !== -1 && fim > inicio) {
    return bruto.slice(inicio, fim + 1);
  }
  return bruto;
}

const CTX_SEM_TOOLS =
  "INSTRUÇÃO DO SISTEMA: Responda DIRETAMENTE com o JSON solicitado. NÃO use ferramentas (Python, search, open_url). NÃO faça buscas. Apenas processe o conteúdo recebido e retorne o JSON.";

/** Detecta linhas de saldo que a IA eventualmente confunde com movimentação (bug real observado em produção). */
function pareceLinhaDeSaldo(descricao: string): boolean {
  return /\bSALDO\s*(DO\s*DIA|ANTERIOR|ATUAL|DISPON[IÍ]VEL|EM\s*CONTA)?\b/i.test(descricao) &&
    !/\b(PIX|TED|DOC|BOLETO|COMPRA|PAGAMENTO|TRANSFER[EÊ]NCIA|SAQUE|DEP[OÓ]SITO)\b/i.test(descricao);
}

/** Converte string monetária BR ("1.234,56" ou "-1.234,56") em number. Aceita também number já pronto. */
function paraNumero(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (typeof valor !== "string") return NaN;
  const limpo = valor.replace(/\./g, "").replace(",", ".");
  return Number(limpo);
}

/**
 * Normaliza UM item bruto do agente para o formato interno {data, descricao, valor}.
 * O agente devolve ora o formato pedido no prompt (data/descricao/valor), ora um
 * formato alternativo próprio da persona Onyx (date/description/amount/type) —
 * ver comentário em extrairJSON. Aceita ambos sem exigir mudança de comportamento
 * do agente (que está fora do nosso controle, configurado na plataforma Onyx).
 */
function normalizarItemAgente(item: unknown): { data: string; descricao: string; valor: number } | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;

  // Formato esperado (pedido no PROMPT_ORGANIZACAO)
  const direto = transacaoOnyxSchema.safeParse(obj);
  if (direto.success) {
    return { data: direto.data.data.trim(), descricao: direto.data.descricao.trim(), valor: direto.data.valor };
  }

  // Formato alternativo: date/description/amount(+type)
  const data = obj.date ?? obj.data;
  const descricaoBruta = obj.description ?? obj.descricao ?? obj.desc;
  const valorBruto = obj.amount ?? obj.valor ?? obj.value;
  if (typeof data !== "string" || typeof descricaoBruta !== "string" || (typeof valorBruto !== "string" && typeof valorBruto !== "number")) {
    return null;
  }

  let valor = paraNumero(valorBruto);
  if (!Number.isFinite(valor)) return null;

  // Quando o formato alternativo separa sinal em "type" (credit/debit) em vez
  // de usar valor negativo diretamente, aplica o sinal correto.
  const tipo = typeof obj.type === "string" ? obj.type.toLowerCase() : "";
  if (tipo === "debit" && valor > 0) valor = -valor;
  if (tipo === "credit" && valor < 0) valor = Math.abs(valor);

  return { data: data.trim(), descricao: descricaoBruta.trim(), valor };
}

/**
 * Converte o JSON bruto devolvido pelo agente em transações validadas.
 * Valida/normaliza item a item — um item malformado é descartado individualmente
 * (logado), sem invalidar a página inteira. Também filtra linhas de saldo que
 * a IA eventualmente inclui por engano (ver PROMPT_ORGANIZACAO).
 */
function parseTransacoes(textoResposta: string, labelPagina: string): TransacaoNormalizada[] {
  const jsonLimpo = extrairJSON(textoResposta);
  const parsedBruto = JSON.parse(jsonLimpo) as unknown;
  const arrayValidado = transacoesOnyxArraySchema.parse(parsedBruto);

  const resultado: TransacaoNormalizada[] = [];
  let descartadosValidacao = 0;
  let descartadosSaldo = 0;

  for (const item of arrayValidado) {
    const normalizado = normalizarItemAgente(item);
    if (!normalizado) {
      descartadosValidacao++;
      continue;
    }

    const descricao = normalizado.descricao.toUpperCase();
    const valor = Number(normalizado.valor) || 0;
    const data = normalizado.data;

    if (!descricao || valor === 0) continue;

    if (pareceLinhaDeSaldo(descricao)) {
      descartadosSaldo++;
      continue;
    }

    resultado.push({ data, descricao, valor });
  }

  if (descartadosValidacao > 0) {
    console.warn(`[extrato-agents][${labelPagina}] ${descartadosValidacao} item(ns) descartado(s) por falha de validação/normalização`);
  }
  if (descartadosSaldo > 0) {
    console.warn(`[extrato-agents][${labelPagina}] ${descartadosSaldo} item(ns) descartado(s) por parecer linha de saldo, não transação`);
  }

  return resultado;
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
    return parseTransacoes(textoOrganizado, `pagina${indicePagina + 1}`);
  } catch {
    throw new OnyxError(
      `Não foi possível interpretar o JSON retornado pelo agente organizador (página ${indicePagina + 1}).`,
      502,
    );
  }
}

/**
 * Processa um extrato bancário (PDF ou Word .docx): extração de texto por
 * página real (pdf-parse, com fallback OCR via PDF24 se o PDF não tiver texto
 * nativo; mammoth para .docx, tratado como uma única "página") + Agente Onyx único.
 * Cada página vira UMA chamada ao Agente Organizador de Extratos Bancários
 * (ID 32) — evita cortar uma transação no meio (o que acontecia ao dividir o
 * texto corrido por tamanho de caractere). Os resultados de todas as páginas
 * são agregados no final, com deduplicação de segurança.
 *
 * Falha em UMA página NÃO aborta o processamento das demais — a página que
 * falhar (mesmo após as tentativas internas de `organizarPagina`) entra em
 * `paginasComErro` (com o texto dela, pra permitir reprocessar depois sem
 * reler o arquivo) e o loop continua. Só lança erro fatal se não houver NENHUMA
 * página com texto extraível (nada para processar).
 */
export async function processarExtratoPorAgentes(
  arquivoBlob: Blob,
  nomeArquivo: string,
): Promise<{ transacoes: TransacaoNormalizada[]; paginasComErro: PaginaComErro[] }> {
  // 1. Extrai o texto de cada página real do arquivo (PDF) ou do documento inteiro (.docx)
  const buffer = Buffer.from(await arquivoBlob.arrayBuffer());
  const paginas = await extrairPaginas(buffer, nomeArquivo);

  if (paginas.length === 0) {
    throw new OnyxError(
      isDocx(nomeArquivo)
        ? "Não foi possível extrair texto do documento Word. O arquivo pode estar corrompido, protegido, ou vazio."
        : "Não foi possível extrair texto do PDF. O arquivo pode estar corrompido, protegido, ou ser um PDF de imagem sem camada de texto (scan sem OCR).",
      422,
    );
  }

  console.log(`[extrato-agents] ${paginas.length} página(s) com texto útil — verificando parser determinístico`);

  // Layouts validados contra amostras reais são resolvidos localmente. Além de
  // evitar dependência da disponibilidade do agente, isso preserva exatamente
  // os sinais e as quebras de página conhecidas desses extratos. Layouts não
  // reconhecidos continuam no fluxo por agentes logo abaixo.
  const parserDetectado = detectarParserExtrato(paginas.join("\n"));
  if (parserDetectado) {
    const transacoes = parserDetectado.parser.parse(paginas.join("\n"));
    if (transacoes.length > 0) {
      console.log(
        `[extrato-agents] parser determinístico ${parserDetectado.bancoId}: ${transacoes.length} transação(ões)`,
      );
      return { transacoes, paginasComErro: [] };
    }

    console.warn(
      `[extrato-agents] parser determinístico ${parserDetectado.bancoId} não encontrou transações — usando fallback por agentes`,
    );
  }

  console.log(`[extrato-agents] layout sem resultado determinístico — enviando ao Agente Organizador`);

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
