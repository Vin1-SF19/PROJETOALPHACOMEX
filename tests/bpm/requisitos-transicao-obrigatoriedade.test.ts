import { expect, it } from "vitest";
import { campoObrigatorioAoMover, requisitoAplicaAoMover, validarValorRequisitoCampo } from "@/lib/bpm/requisitos-etapa";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";

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

it("aceita no avanço a forma de pagamento salva em opção relacional ativa", () => {
  const campo = {
    id: "forma-pagamento", nome: "Forma de pagamento", tipo: "selecao", opcoesJson: null,
    opcoes: [{ rotulo: "Parcelamento Cartão de Crédito - até 12x com juros" }],
  };

  expect(validarValorRequisitoCampo(campo, "Parcelamento Cartão de Crédito - até 12x com juros")).toBe(true);
  expect(validarValorRequisitoCampo(campo, "Opção removida")).toBe(false);
});

it("bloqueia a revisão do protocolo até as duas confirmações booleanas serem Sim", () => {
  const campos = ["documentos", "codigos"].map((id) => ({ id, nome: id, tipo: "booleano", opcoesJson: null }));
  const pendente = (campo: string) => ({ operador: "AND" as const, condicoes: [{
    tipo: "condicao" as const,
    campo: { fonte: "campo_dinamico" as const, campo },
    operador: "diferente" as const,
    valor: "Sim",
  }] });

  for (const valores of [
    { documentos: null, codigos: null },
    { documentos: "Não", codigos: "Sim" },
    { documentos: "Sim", codigos: "Não" },
  ]) {
    expect(["documentos", "codigos"].some((id) => avaliarGrupo(pendente(id), { card: {}, camposDinamicos: valores }))).toBe(true);
  }
  const validos = { documentos: "Sim", codigos: "Sim" };
  expect(validarValoresCamposBpm(campos, validos)).toEqual({ success: true, valores: validos });
  expect(["documentos", "codigos"].some((id) => avaliarGrupo(pendente(id), { card: {}, camposDinamicos: validos }))).toBe(false);
  expect(validarValoresCamposBpm(campos, { documentos: "Talvez" }).success).toBe(false);
});
