import esbuild from "esbuild";
import postcss from "postcss";
import tailwindcssPostcss from "@tailwindcss/postcss";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENTRY = path.join(ROOT, "src/apresentacoes-player/entry.tsx");
const CSS_ENTRY = path.join(ROOT, "src/apresentacoes-player/player.css");
const OUTPUT = path.join(ROOT, "src/generated/apresentacoes-player-bundle.ts");
const LOGO_PATH = path.join(ROOT, "public/A.PNG");
// Chave = especificador exatamente como escrito em ContainerCargaModel.tsx; valor = caminho
// absoluto do módulo que substitui, só no bundle do player (ver esbuild `alias` abaixo).
const CONTAINER_CARGA_ASSETS_ESPECIFICADOR = "@/lib/apresentacoes/container-carga-assets";
const CONTAINER_CARGA_ASSETS_PLAYER_MODULE = path.join(ROOT, "src/lib/apresentacoes/container-carga-assets.player.ts");

/**
 * O player exportado roda 100% offline (script clássico dentro do .html baixado, sem
 * servidor Next por trás) — nenhum módulo do pacote "next" nem arquivo com "use server" pode
 * entrar nesse bundle. Esses 2 guards transformam essa restrição numa checagem automática a
 * cada build, em vez de depender só de revisão manual de import.
 */
function verificarSemImportDeNext(metafile) {
  const arquivosFonte = Object.keys(metafile.inputs);
  const importsNext = arquivosFonte.filter((arquivo) => /node_modules[\\/]next[\\/]/.test(arquivo));
  if (importsNext.length > 0) {
    throw new Error(
      `Bundle do player importou módulo(s) do pacote "next" (proibido — o player roda sem Next.js):\n${importsNext.join("\n")}`,
    );
  }
}

function verificarSemUseServer(metafile) {
  const arquivosFonte = Object.keys(metafile.inputs).filter((arquivo) => !arquivo.includes("node_modules"));
  const comUseServer = arquivosFonte.filter((arquivo) => {
    const caminhoAbsoluto = path.isAbsolute(arquivo) ? arquivo : path.join(ROOT, arquivo);
    if (!fs.existsSync(caminhoAbsoluto)) return false;
    const inicio = fs.readFileSync(caminhoAbsoluto, "utf8").slice(0, 200);
    return /^\s*["']use server["']/.test(inicio);
  });
  if (comUseServer.length > 0) {
    throw new Error(
      `Bundle do player incluiu arquivo(s) com "use server" (proibido — não pode haver Server Action no bundle offline):\n${comUseServer.join("\n")}`,
    );
  }
}

function lerLogoComoDataUri() {
  const bytes = fs.readFileSync(LOGO_PATH);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

async function bundlarJs() {
  const logoDataUri = lerLogoComoDataUri();

  const resultado = await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    minify: true,
    write: false,
    metafile: true,
    jsx: "automatic",
    // O CSS do @xyflow/react (importado direto por RenderBusiness.tsx) já entra pelo
    // pipeline PostCSS/Tailwind em compilarCss() — aqui só evita erro/duplicação no bundle JS.
    loader: { ".css": "empty" },
    absWorkingDir: ROOT,
    alias: {
      // Explícito em vez de depender só da auto-detecção do tsconfig.json pelo esbuild —
      // mesmo alias "@/*" -> "./src/*" já configurado em tsconfig.json.
      "@": path.join(ROOT, "src"),
      // Troca SÓ neste bundle: ContainerCargaModel.tsx pede LOGO_A_URL de
      // container-carga-assets.ts (fica "/A.PNG", servido pelo Next) — aqui vira a variante
      // .player.ts, que embute o mesmo arquivo como data: URI (ver define abaixo).
      [CONTAINER_CARGA_ASSETS_ESPECIFICADOR]: CONTAINER_CARGA_ASSETS_PLAYER_MODULE,
    },
    define: { __LOGO_A_DATA_URI__: JSON.stringify(logoDataUri) },
  });

  verificarSemImportDeNext(resultado.metafile);
  verificarSemUseServer(resultado.metafile);

  const js = resultado.outputFiles[0].text;
  if (!js.includes("data:image/png;base64,")) {
    throw new Error(
      "O alias do logo do Container Alpha (/A.PNG) não foi aplicado — o bundle não contém o data: URI esperado. " +
        "Confirme se ContainerCargaModel.tsx ainda importa LOGO_A_URL de \"@/lib/apresentacoes/container-carga-assets\".",
    );
  }

  return js;
}

async function compilarCss() {
  const cssFonte = fs.readFileSync(CSS_ENTRY, "utf8");
  const resultado = await postcss([tailwindcssPostcss()]).process(cssFonte, { from: CSS_ENTRY, to: undefined });
  return resultado.css;
}

async function main() {
  console.log("[build-apresentacoes-player] bundlando JS...");
  const js = await bundlarJs();
  console.log(`[build-apresentacoes-player] JS: ${(js.length / 1024).toFixed(1)} KB`);

  console.log("[build-apresentacoes-player] compilando CSS...");
  const css = await compilarCss();
  console.log(`[build-apresentacoes-player] CSS: ${(css.length / 1024).toFixed(1)} KB`);

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

  const conteudo = `// Gerado automaticamente por scripts/build-apresentacoes-player.mjs — não editar à mão.
export const PLAYER_JS = ${JSON.stringify(js)};
export const PLAYER_CSS = ${JSON.stringify(css)};
`;
  fs.writeFileSync(OUTPUT, conteudo, "utf8");
  console.log(`[build-apresentacoes-player] gerado em ${path.relative(ROOT, OUTPUT)}`);
}

main().catch((erro) => {
  console.error("[build-apresentacoes-player] falhou:", erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
