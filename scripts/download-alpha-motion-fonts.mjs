import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIRETORIO_FONTES = path.join(ROOT, "public/fonts/alpha-motion");
const CSS_SAIDA = path.join(ROOT, "src/app/alpha-motion-fonts.css");
const PESOS_USADOS = [400, 700];
const URL_GOOGLE_FONTS = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300..700;1,300..700&family=Inter:ital,wght@0,300..900;1,300..900&family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&family=Merriweather:ital,opsz,wght@0,18..144,300..900;1,18..144,300..900&family=Montserrat:ital,wght@0,300..900;1,300..900&family=Nunito:ital,wght@0,300..900;1,300..900&family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Oswald:wght@300..700&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Raleway:ital,wght@0,300..900;1,300..900&family=Roboto:ital,wght@0,300..900;1,300..900&family=Roboto+Mono:ital,wght@0,300..700;1,300..700&family=Source+Sans+3:ital,wght@0,300..900;1,300..900&display=swap";

function extrair(bloco, propriedade) {
  return bloco.match(new RegExp(`${propriedade}:\\s*([^;]+);`))?.[1]?.trim();
}

function slug(valor) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pesoNecessario(peso) {
  const numeros = peso.split(/\s+/).map(Number).filter(Number.isFinite);
  if (numeros.length === 1) return PESOS_USADOS.includes(numeros[0]);
  if (numeros.length === 2) return PESOS_USADOS.some((usado) => usado >= numeros[0] && usado <= numeros[1]);
  return false;
}

async function baixar(url, destino) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${resposta.status}`);
  const bytes = Buffer.from(await resposta.arrayBuffer());
  if (bytes.length < 1000) throw new Error(`Fonte inválida ou vazia recebida de ${url}`);
  await fs.writeFile(destino, bytes);
  return bytes.length;
}

async function main() {
  const respostaCss = await fetch(URL_GOOGLE_FONTS, {
    headers: { "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/140 Safari/537.36" },
  });
  if (!respostaCss.ok) throw new Error(`Google Fonts respondeu HTTP ${respostaCss.status}`);
  const cssRemoto = await respostaCss.text();
  const blocosLatinos = Array.from(cssRemoto.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[\s\S]*?\})/g), (match) => match[1]);
  const faces = blocosLatinos
    .map((bloco) => ({
      family: extrair(bloco, "font-family")?.replace(/["']/g, ""),
      style: extrair(bloco, "font-style"),
      weight: extrair(bloco, "font-weight"),
      unicodeRange: extrair(bloco, "unicode-range"),
      url: bloco.match(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1],
    }))
    .filter((face) => face.family && face.style && face.weight && face.url && pesoNecessario(face.weight));

  if (faces.length === 0) throw new Error("Nenhuma fonte latina foi encontrada na resposta do Google Fonts");
  await fs.mkdir(DIRETORIO_FONTES, { recursive: true });
  await fs.mkdir(path.dirname(CSS_SAIDA), { recursive: true });

  let totalBytes = 0;
  const cssLocal = ["/* Gerado por scripts/download-alpha-motion-fonts.mjs — não editar manualmente. */", ""];
  for (const face of faces) {
    const arquivo = `${slug(face.family)}-${face.style}-${face.weight.replace(/\s+/g, "-")}.woff2`;
    totalBytes += await baixar(face.url, path.join(DIRETORIO_FONTES, arquivo));
    cssLocal.push(
      "@font-face {",
      `  font-family: "${face.family}";`,
      `  font-style: ${face.style};`,
      `  font-weight: ${face.weight};`,
      "  font-display: swap;",
      `  src: url("/fonts/alpha-motion/${arquivo}") format("woff2");`,
      ...(face.unicodeRange ? [`  unicode-range: ${face.unicodeRange};`] : []),
      "}",
      "",
    );
  }

  await fs.writeFile(CSS_SAIDA, `${cssLocal.join("\n")}\n`, "utf8");
  console.log(`[fontes-alpha-motion] ${faces.length} arquivos locais, ${(totalBytes / 1024).toFixed(1)} KB`);
}

main().catch((erro) => {
  console.error("[fontes-alpha-motion] falhou:", erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
