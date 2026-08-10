import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FONTES_ALPHA_MOTION } from "@/lib/apresentacoes/fontes";

const raiz = process.cwd();
const cssFontes = fs.readFileSync(path.join(raiz, "src/app/alpha-motion-fonts.css"), "utf8");
const cssGlobal = fs.readFileSync(path.join(raiz, "src/app/globals.css"), "utf8");
const cssPlayer = fs.readFileSync(path.join(raiz, "src/apresentacoes-player/player.css"), "utf8");
const scriptBuildPlayer = fs.readFileSync(path.join(raiz, "scripts/build-apresentacoes-player.mjs"), "utf8");

describe("fontes locais do Alpha Motion", () => {
  it.each(FONTES_ALPHA_MOTION)("possui arquivo local para $nome", ({ nome }) => {
    expect(cssFontes).toContain(`font-family: "${nome}"`);
    const urls = Array.from(cssFontes.matchAll(/url\("(\/fonts\/alpha-motion\/[^\"]+)"\)/g), (match) => match[1]);
    const prefixo = nome.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const arquivosDaFonte = urls.filter((url) => path.basename(url).startsWith(prefixo));
    expect(arquivosDaFonte.length).toBeGreaterThan(0);
    for (const url of arquivosDaFonte) {
      expect(fs.statSync(path.join(raiz, "public", url.replace(/^\//, ""))).size).toBeGreaterThan(1000);
    }
  });

  it("não depende do Google Fonts em runtime", () => {
    expect(cssGlobal).not.toContain("fonts.googleapis.com");
    expect(cssPlayer).not.toContain("fonts.googleapis.com");
    expect(cssGlobal).toContain('@import "./alpha-motion-fonts.css"');
    expect(cssPlayer).toContain('@import "../app/alpha-motion-fonts.css"');
  });

  it("configura a incorporação das fontes no HTML exportado", () => {
    expect(scriptBuildPlayer).toContain('data:font/woff2;base64,');
    expect(scriptBuildPlayer).toContain('public/fonts/alpha-motion');
    expect(scriptBuildPlayer).toContain('O CSS do player ainda contém referência externa');
  });
});
