import { readFile } from "node:fs/promises";
import { extrairApresentacaoPptx } from "../../src/lib/apresentacoes/pptx/parser";

async function main() {
console.info = () => undefined;
const pptx = await readFile("C:/Users/TI/Downloads/Plano de Marketing.pptx");
const result = await extrairApresentacaoPptx(pptx, { width: 1600, height: 900 });

const summary = result.slides.map((slide, index) => ({
  slide: index + 1,
  backgroundColor: slide.backgroundColor,
  backgroundImage: Boolean(slide.backgroundImage),
  formas: slide.formas.length,
  tipos: Object.fromEntries([...new Set(slide.formas.map((forma) => forma.tipo))].map((tipo) => [tipo, slide.formas.filter((forma) => forma.tipo === tipo).length])),
  items: slide.formas.map((forma) => ({
    tipo: forma.tipo,
    x: Math.round(forma.x * 10) / 10,
    y: Math.round(forma.y * 10) / 10,
    w: Math.round(forma.w * 10) / 10,
    h: Math.round(forma.h * 10) / 10,
    z: forma.zIndex,
    ...(forma.tipo === "caixa" ? { formato: forma.formato, cor: forma.corFundo, gradiente: forma.gradientCss, texto: forma.textoInterno?.paragrafos.join(" / ") } : {}),
    ...(forma.tipo === "texto" ? { texto: forma.paragrafos.join(" / "), fonte: forma.fontFamily, tamanho: forma.tamanhoFonte, cor: forma.corTexto, alinhamento: forma.alinhamento } : {}),
    ...(forma.tipo === "imagem" ? { mime: forma.mimeType, arquivo: forma.nomeArquivo, bytes: forma.bytes.byteLength } : {}),
  })),
}));

console.log(JSON.stringify({
  summary,
  fontesEmbutidas: result.fontesEmbutidas.map((fonte) => ({ nome: fonte.nome, formato: fonte.formato, bytes: fonte.bytes.byteLength })),
  ignorados: result.ignorados,
  diagnosticos: result.diagnostico,
}, null, 2));
}

void main();
