import { expect, it } from "vitest";
import { campoObrigatorioAoMover, requisitoAplicaAoMover } from "@/lib/bpm/requisitos-etapa";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";

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

it("não avalia a condição de elaboração antes de entrar na etapa", () => {
  const elaboracao = { etapaId: "elaboracao", transicaoId: null, fase: "DURING_STAGE" };
  const conferirNaEntrada = { ...elaboracao, fase: "ENTER_STAGE" };
  const condicao = { operador: "AND" as const, condicoes: [{
    tipo: "condicao" as const,
    campo: { fonte: "campo_dinamico" as const, campo: "contrato-elaborado" },
    operador: "igual" as const,
    valor: "Sim",
  }] };

  expect(requisitoAplicaAoMover(elaboracao, "transicao", "solicitacao", "elaboracao")).toBe(false);
  expect(requisitoAplicaAoMover(conferirNaEntrada, "transicao", "solicitacao", "elaboracao")).toBe(true);
  expect(requisitoAplicaAoMover(elaboracao, "transicao", "elaboracao", "formalizacao")).toBe(true);
  expect(avaliarGrupo(condicao, { card: {}, camposDinamicos: { "contrato-elaborado": null } })).toBe(false);
});
