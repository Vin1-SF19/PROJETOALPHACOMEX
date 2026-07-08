import "server-only";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * pdfjs-dist (dependência interna do pdf-parse v2) tenta usar @napi-rs/canvas
 * para operações de renderização (getImage/getScreenshot) mesmo quando só se
 * quer extrair texto (getText). No runtime serverless da Vercel o binário
 * nativo do @napi-rs/canvas para a plataforma do Lambda não fica disponível,
 * e o pdfjs cai no polyfill de DOMMatrix — que não existe em Node puro,
 * lançando "DOMMatrix is not defined" e derrubando a rota com 500.
 * Como este projeto só usa getText() (nunca renderização), um polyfill vazio
 * é suficiente: as classes nunca são de fato exercitadas na extração de texto.
 */
class DOMMatrixPolyfill {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  constructor(..._args: unknown[]) {}
  multiply() {
    return this;
  }
  translate() {
    return this;
  }
  scale() {
    return this;
  }
  inverse() {
    return this;
  }
}

if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix === "undefined") {
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixPolyfill;
}

/**
 * Mesmo em modo "fake worker" (main thread, sem thread real — o único modo
 * viável em Node/serverless), o pdfjs faz `import(this.workerSrc)` dinâmico
 * pra pegar `WorkerMessageHandler`, a menos que `globalThis.pdfjsWorker` já
 * esteja setado (nesse caso ele pula o import). Como o specifier é uma
 * string variável resolvida em runtime, o file tracing do Next.js não
 * consegue seguir esse caminho e deixa `pdf.worker.mjs` de fora do bundle da
 * Vercel — causando "Cannot find module .../pdf.worker.mjs".
 * Pré-carregamos o worker aqui via caminho de arquivo absoluto (resolvido a
 * partir do pdfjs-dist REALMENTE usado pelo pdf-parse — não o da raiz do
 * projeto, que é uma versão diferente) e registramos em globalThis.pdfjsWorker
 * para o pdfjs pular o import dinâmico problemático por completo.
 */
async function preloadPdfjsWorker() {
  if ((globalThis as { pdfjsWorker?: unknown }).pdfjsWorker) return;

  try {
    const pdfMjsPath = require.resolve("pdfjs-dist/legacy/build/pdf.mjs", {
      paths: [path.join(process.cwd(), "node_modules/pdf-parse")],
    });
    const workerPath = path.join(path.dirname(pdfMjsPath), "pdf.worker.mjs");
    const workerModule = await import(pathToFileURL(workerPath).href);
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = workerModule;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[pdfjs-polyfill] não foi possível pré-carregar o worker do pdfjs-dist: ${msg}`);
  }
}

export const pdfjsWorkerReady = preloadPdfjsWorker();
