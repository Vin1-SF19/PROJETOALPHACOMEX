#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fixtureCliSchema, avaliarRegra } from "../src/lib/bpm/regras/index.ts";

const LIMITE_ENTRADA = 1024 * 1024;
function saidaErro(codigo, mensagem, detalhes) {
  return { regra: null, versao: null, resultado: null, mensagens: [], erros: [{ codigo, mensagem, ...(detalhes ? { detalhes } : {}) }] };
}
function imprimir(saida, code) { process.stdout.write(`${JSON.stringify(saida, null, 2)}\n`); process.exitCode = code; }

try {
  const argumento = process.argv[2];
  if (!argumento) {
    imprimir(saidaErro("USO_INVALIDO", "Uso: npm run bpm:regras -- <fixture.json> | --stdin"), 2);
  } else {
    let conteudo;
    if (argumento === "--stdin") conteudo = readFileSync(0, { encoding: "utf8" });
    else {
      const raiz = process.cwd();
      const arquivo = resolve(raiz, argumento);
      const caminhoRelativo = relative(raiz, arquivo);
      if (caminhoRelativo.startsWith("..") || resolve(arquivo) === resolve(raiz)) throw new Error("FIXTURE_FORA_DO_PROJETO");
      conteudo = readFileSync(arquivo, "utf8");
    }
    if (Buffer.byteLength(conteudo) > LIMITE_ENTRADA) imprimir(saidaErro("ENTRADA_EXCEDIDA", "Fixture excede 1 MiB"), 2);
    else {
      let json;
      try { json = JSON.parse(conteudo); } catch { json = null; }
      if (json === null) imprimir(saidaErro("JSON_INVALIDO", "Fixture não contém JSON válido"), 2);
      else {
        const fixture = fixtureCliSchema.safeParse(json);
        if (!fixture.success) imprimir(saidaErro("FIXTURE_INVALIDA", "Contexto ou regra inválidos", fixture.error.flatten()), 2);
        else {
          const resultado = avaliarRegra(fixture.data.regra, fixture.data.contexto);
          imprimir({
            regra: { id: fixture.data.regra.id, nome: fixture.data.regra.nome },
            versao: fixture.data.regra.versao,
            resultado,
            mensagens: resultado.mensagens ?? [],
            erros: resultado.erros ?? [],
          }, resultado.erros?.length ? 1 : 0);
        }
      }
    }
  }
} catch (erro) {
  const fora = erro instanceof Error && erro.message === "FIXTURE_FORA_DO_PROJETO";
  imprimir(saidaErro(fora ? "FIXTURE_FORA_DO_PROJETO" : "LEITURA_FALHOU", fora ? "A fixture deve estar dentro do projeto" : "Não foi possível ler a fixture"), 2);
}
