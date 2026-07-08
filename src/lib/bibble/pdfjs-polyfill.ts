import "server-only";

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
