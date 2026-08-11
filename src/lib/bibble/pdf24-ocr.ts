/**
 * OCR via PDF24 (Cross Service Solutions) — fallback para PDFs de imagem/scan
 * sem camada de texto, onde Tika e pdf-parse não têm o que extrair.
 * API assíncrona: cria um job de OCR, faz polling até concluir, baixa o PDF
 * resultante (agora com texto pesquisável).
 * URL/chave configuradas em PDF24_OCR_API_URL / PDF24_OCR_API_KEY.
 */

const PDF24_URL = (process.env.PDF24_OCR_API_URL ?? "").replace(/\/+$/, "");
const PDF24_KEY = process.env.PDF24_OCR_API_KEY ?? "";
// Id da "solução" PDF OCR na plataforma Cross Service Solutions — o endpoint
// de criação de job é POST /api/{solutionId}, não POST /api/ (a documentação
// do widget mostra esse número solto ao lado do método POST, sem deixar claro
// que faz parte do path; confirmado testando contra a API real).
const PDF24_SOLUTION_ID = "67";

const PDF24_POLL_INTERVAL_MS = 5_000;
// OCR real em PDFs de scan é lento — testado contra a API com um PDF de 3
// páginas e o job seguiu "in_progress" por vários minutos. 8 minutos de
// margem para não abortar prematuramente um job que ainda vai concluir.
const PDF24_POLL_TIMEOUT_MS = 480_000;
const PDF24_REQUEST_TIMEOUT_MS = 30_000;

export function isPdf24Configured(): boolean {
  return Boolean(PDF24_URL && PDF24_KEY);
}

export function resolveSameOriginUrl(baseValue: string, candidate: string): URL {
  const base = new URL(baseValue);
  const resolved = new URL(candidate, `${baseValue.replace(/\/+$/, "")}/`);
  if (resolved.origin !== base.origin) {
    throw new Error("Destino PDF24 fora da origem configurada");
  }
  return resolved;
}

async function fetchPdf24(candidate: string, init: RequestInit): Promise<Response> {
  const url = resolveSameOriginUrl(PDF24_URL, candidate);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${PDF24_KEY}`);
  const response = await fetch(url, {
    ...init,
    redirect: "manual",
    headers,
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Redirecionamento PDF24 bloqueado");
  }
  if (response.url) resolveSameOriginUrl(PDF24_URL, response.url);
  return response;
}

interface Pdf24JobFile {
  name: string;
  path: string;
}

interface Pdf24JobResponse {
  id: number;
  name: string;
  status: string;
  steps?: Array<{ name: string; status: string }>;
  output: { result: string; data: unknown; files: Pdf24JobFile[] } | null;
}

/** Cria o job de OCR no PDF24 e retorna o id para consulta/polling. */
async function criarJobOcr(buffer: Buffer, fileName: string): Promise<number> {
  if (!isPdf24Configured()) {
    throw new Error("PDF24 OCR não configurado (PDF24_OCR_API_URL / PDF24_OCR_API_KEY ausentes).");
  }

  const form = new FormData();
  const blob = new Blob([buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer], {
    type: "application/pdf",
  });
  form.append("files", blob, fileName);
  form.append("langCode", "por");
  form.append("outputType", "pdf");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PDF24_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetchPdf24(`${PDF24_URL}/api/${PDF24_SOLUTION_ID}`, {
      method: "POST",
      signal: ctrl.signal,
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`PDF24 recusou o job (${res.status}): ${body || "sem detalhes"}`);
    }

    const data = (await res.json()) as Pdf24JobResponse;
    if (typeof data.id !== "number") {
      throw new Error("PDF24 não retornou um id de job válido.");
    }

    console.info("[BIBBLE PDF] ocr-job", { stage: "created", source: "pdf24-ocr" });
    return data.id;
  } finally {
    clearTimeout(timer);
  }
}

/** Consulta o status do job. Lança Error se a resposta não for ok. */
async function consultarJobOcr(jobId: number): Promise<Pdf24JobResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PDF24_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetchPdf24(`${PDF24_URL}/api/${jobId}`, {
      method: "GET",
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`PDF24 falhou ao consultar job ${jobId} (${res.status}): ${body || "sem detalhes"}`);
    }

    return (await res.json()) as Pdf24JobResponse;
  } finally {
    clearTimeout(timer);
  }
}

const STATUS_FALHA = new Set(["error", "failed", "failure", "cancelled", "canceled"]);

/**
 * Faz polling do job até `output.files` vir preenchido (sinal mais confiável
 * de conclusão real — testado contra a API: `output` já vem não-null com
 * `files: []` desde o status "pending"/"in_progress", então SÓ a presença de
 * `output` não basta; é preciso `files.length > 0`). Aborta cedo se `status`
 * indicar falha explícita. Lança Error se estourar PDF24_POLL_TIMEOUT_MS.
 */
async function aguardarJobOcr(jobId: number): Promise<Pdf24JobFile> {
  const inicio = Date.now();

  while (Date.now() - inicio < PDF24_POLL_TIMEOUT_MS) {
    const job = await consultarJobOcr(jobId);

    if (job.output?.files && job.output.files.length > 0) {
      console.info("[BIBBLE PDF] ocr-job", { stage: "completed", source: "pdf24-ocr", status: job.status });
      return job.output.files[0];
    }

    if (STATUS_FALHA.has(job.status.toLowerCase())) {
      throw new Error(`PDF24 reportou falha no job ${jobId} (status=${job.status}).`);
    }

    console.info("[BIBBLE PDF] ocr-job", { stage: "polling", source: "pdf24-ocr", status: job.status });
    await new Promise((resolve) => setTimeout(resolve, PDF24_POLL_INTERVAL_MS));
  }

  throw new Error(`PDF24 não concluiu o job ${jobId} em ${PDF24_POLL_TIMEOUT_MS / 1000}s (timeout).`);
}

/** Resolve a URL final do arquivo (absoluta ou relativa à base da API) e baixa o binário. */
async function baixarArquivoOcr(file: Pdf24JobFile): Promise<Buffer> {
  const url = resolveSameOriginUrl(PDF24_URL, file.path).href;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PDF24_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetchPdf24(url, {
      method: "GET",
      signal: ctrl.signal,
    });

    if (!res.ok) {
      throw new Error(`PDF24 falhou ao baixar arquivo processado (${res.status}): ${url}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executa o OCR completo: cria o job, aguarda concluir, baixa o PDF
 * resultante (com camada de texto pesquisável).
 * Lança Error em qualquer falha — quem chama decide o fallback.
 */
export async function ocrViaPdf24(buffer: Buffer, fileName: string): Promise<Buffer> {
  const jobId = await criarJobOcr(buffer, fileName);
  const arquivo = await aguardarJobOcr(jobId);
  console.info("[BIBBLE PDF] ocr-job", { stage: "downloading", source: "pdf24-ocr" });
  const resultado = await baixarArquivoOcr(arquivo);
  console.info("[BIBBLE PDF] ocr-job", { stage: "downloaded", source: "pdf24-ocr", bytes: resultado.length });
  return resultado;
}
