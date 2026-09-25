import { expect, it } from "vitest";
import { campoObrigatorioAoMover } from "@/lib/bpm/requisitos-etapa";

it("permite entrar em Elaboração antes de marcar os campos que serão preenchidos nessa etapa", () => {
  for (const nome of ["Contrato elaborado", "Contrato enviado para assinatura"]) {
    const destino = { nome, obrigatorio: true, obrigatorioEntrada: false, obrigatorioSaida: false };
    expect(campoObrigatorioAoMover({ destino })).toBe(false);
  }
});

it("continua cobrando apenas obrigações da saída da origem e da entrada do destino", () => {
  expect(campoObrigatorioAoMover({ origem: { obrigatorio: true } })).toBe(true);
  expect(campoObrigatorioAoMover({ origem: { obrigatorioSaida: true } })).toBe(true);
  expect(campoObrigatorioAoMover({ destino: { obrigatorioEntrada: true } })).toBe(true);
});
