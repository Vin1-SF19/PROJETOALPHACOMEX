import { describe, expect, it } from "vitest";
import { criarRastreadorRascunho, type SnapshotRascunho } from "@/lib/bpm/rascunho-versionado";

function promiseControlada<T>() {
  let resolver!: (valor: T) => void;
  const promise = new Promise<T>((resolve) => { resolver = resolve; });
  return { promise, resolver };
}

describe("CRM - concorrência de rascunhos de data e hora", () => {
  it("não confirma um save antigo quando uma hora mais recente foi editada", async () => {
    const rastreador = criarRastreadorRascunho("2026-09-04T09:00");
    const primeiraResposta = promiseControlada<void>();
    const segundaResposta = promiseControlada<void>();

    const primeiroSnapshot = rastreador.alterar("2026-09-04T10:00");
    const confirmar = async (snapshot: SnapshotRascunho, promise: Promise<void>) => {
      await promise;
      return rastreador.corresponde(snapshot);
    };
    const primeiroSave = confirmar(primeiroSnapshot, primeiraResposta.promise);

    const segundoSnapshot = rastreador.alterar("2026-09-04T11:30");
    const segundoSave = confirmar(segundoSnapshot, segundaResposta.promise);

    primeiraResposta.resolver();
    expect(await primeiroSave).toBe(false);
    expect(rastreador.capturar().valor).toBe("2026-09-04T11:30");

    segundaResposta.resolver();
    expect(await segundoSave).toBe(true);
  });

  it("mantém o rascunho após erro e permite confirmar a mesma revisão no retry", async () => {
    const rastreador = criarRastreadorRascunho("2030-12-31T23:59");
    const snapshot = rastreador.alterar("2031-01-01T00:00");

    const confirmar = async (resultado: boolean) => resultado && rastreador.corresponde(snapshot);

    expect(await confirmar(false)).toBe(false);
    expect(rastreador.capturar()).toEqual(snapshot);
    expect(await confirmar(true)).toBe(true);
    expect(rastreador.capturar().valor).toBe("2031-01-01T00:00");
  });
});
