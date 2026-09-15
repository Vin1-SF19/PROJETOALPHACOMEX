import { describe, expect, it } from "vitest";

import { validarJsonMesclagem, validarMultipartMesclagem } from "@/lib/mesclagem/http-guards";

function requisicao(headers: Record<string, string>) {
  return { headers: new Headers(headers) };
}

describe("Guards HTTP da Mesclagem", () => {
  it("aceita multipart limitado e de mesma origem", () => {
    expect(() => validarMultipartMesclagem(requisicao({
      "content-type": "multipart/form-data; boundary=abc",
      "content-length": "100",
      host: "painel.local",
      origin: "https://painel.local",
      "sec-fetch-site": "same-origin",
    }), 1_000, "Upload excedido")).not.toThrow();
  });

  it("rejeita boundary ausente e origem cruzada", () => {
    expect(() => validarMultipartMesclagem(requisicao({
      "content-type": "multipart/form-data",
      "content-length": "100",
      host: "painel.local",
      origin: "https://painel.local",
    }), 1_000, "Upload excedido")).toThrow(/boundary/i);
    expect(() => validarJsonMesclagem(requisicao({
      "content-type": "application/json",
      "content-length": "10",
      host: "painel.local",
      origin: "https://externo.local",
    }), 1_000)).toThrow(/não permitida/i);
  });

  it("rejeita corpo sem Content-Length ou acima do orçamento", () => {
    const base = { "content-type": "application/json", host: "painel.local", origin: "https://painel.local" };
    expect(() => validarJsonMesclagem(requisicao(base), 1_000)).toThrow(/Content-Length/i);
    expect(() => validarJsonMesclagem(requisicao({ ...base, "content-length": "1001" }), 1_000)).toThrow(/acima do limite/i);
  });
});
