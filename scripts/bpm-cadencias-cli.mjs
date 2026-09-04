#!/usr/bin/env node
/**
 * CLI: npm run bpm:cadencias
 * Invoca processarCadenciasBpm() para avançar cadências vencidas.
 * Uso: npm run bpm:cadencias [-- --verbose]
 */
import { processarCadenciasBpm } from "../src/lib/bpm/cadencias/executor.ts";

const verbose = process.argv.includes("--verbose");

try {
  const resultado = await processarCadenciasBpm();
  const saida = {
    success: true,
    processadas: resultado.processadas,
    falhas: resultado.falhas,
    avisos: verbose ? resultado.avisos : [],
  };
  process.stdout.write(`${JSON.stringify(saida, null, 2)}\n`);
  process.exitCode = resultado.falhas > 0 ? 1 : 0;
} catch (erro) {
  const saida = {
    success: false,
    error: erro instanceof Error ? erro.message : String(erro),
  };
  process.stdout.write(`${JSON.stringify(saida, null, 2)}\n`);
  process.exitCode = 1;
}
