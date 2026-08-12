import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { extrairApresentacaoPptx } from "../../src/lib/apresentacoes/pptx/parser";
import { mapearSlideExtraido } from "../../src/lib/apresentacoes/pptx/mapear";
import { TextoAnimado, RenderImagem, RenderDivisor } from "../../src/components/Apresentacoes/Editor/RenderEngine/render/RenderBasicos";
import { stylePosicaoAbsoluta } from "../../src/components/Apresentacoes/Editor/RenderEngine/posicionamento";
import type { ComponenteSlide } from "../../src/lib/validations/slide-componentes";

const WIDTH = 1600;
const HEIGHT = 900;

function RenderImportComponent({ component }: { component: ComponenteSlide }) {
  if (component.tipo === "texto") return <TextoAnimado componente={component} />;
  if (component.tipo === "imagem") return <RenderImagem componente={component} />;
  if (component.tipo === "divisor") return <RenderDivisor componente={component} />;
  if (component.tipo === "card") return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: component.corFundo ?? "transparent", borderRadius: component.borderRadius ?? 0, padding: component.padding ?? 0, border: component.larguraBorda ? `${component.larguraBorda}px ${component.estiloBorda ?? "solid"} ${component.corBorda ?? "transparent"}` : undefined }}>
      {component.filhos.map((child) => <div key={child.id} style={stylePosicaoAbsoluta(child)}><RenderImportComponent component={child} /></div>)}
    </div>
  );
  return null;
}

async function main() {
  console.info = () => undefined;
  const bytes = await readFile("C:/Users/TI/Downloads/Plano de Marketing.pptx");
  const htmlToImageScript = await readFile("node_modules/html-to-image/dist/html-to-image.js", "utf8");
  const extracted = await extrairApresentacaoPptx(bytes, { width: WIDTH, height: HEIGHT });
  const fontCss = extracted.fontesEmbutidas.map((font) => {
    const data = Buffer.from(font.bytes).toString("base64");
    return `@font-face{font-family:${JSON.stringify(font.nome)};src:url(data:${font.mimeType};base64,${data}) format(${JSON.stringify(font.formato)});font-style:normal;font-weight:100 900;font-display:block}`;
  }).join("");
  const slides = await Promise.all(extracted.slides.map(async (slide) => ({
    canvas: { width: WIDTH, height: HEIGHT, backgroundColor: slide.backgroundColor, backgroundImage: slide.backgroundImage },
    componentes: await mapearSlideExtraido(slide, async (imageBytes, mimeType) =>
      `data:${mimeType};base64,${Buffer.from(imageBytes).toString("base64")}`),
  })));

  const server = createServer((request, response) => {
    if (request.url === "/html-to-image.js") {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      response.end(htmlToImageScript);
      return;
    }
    const match = /^\/slide\/(\d+)$/.exec(request.url ?? "");
    const index = match ? Number(match[1]) - 1 : 0;
    const slide = slides[index];
    if (!slide) {
      response.writeHead(404).end("Slide inexistente");
      return;
    }
    const markup = renderToStaticMarkup(
      <div id="slide" style={{ position: "relative", width: WIDTH, height: HEIGHT, overflow: "hidden", transform: "scale(0.8)", transformOrigin: "top left", backgroundColor: slide.canvas.backgroundColor, backgroundImage: slide.canvas.backgroundImage }}>
        {slide.componentes.map((component) => (
          <div key={component.id} style={stylePosicaoAbsoluta(component)}>
            <RenderImportComponent component={component} />
          </div>
        ))}
      </div>,
    );
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(`<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}*{box-sizing:border-box}html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#000}</style><script src="/html-to-image.js"></script></head><body>${markup}</body></html>`);
  });
  server.listen(4312, "127.0.0.1", () => console.log("HARNESS_READY http://127.0.0.1:4312"));
}

void main();
