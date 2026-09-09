import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  aguardarResultadoCompartilhado,
  TEMPO_LIMITE_AGENDAS_COMPARTILHADAS_MS,
} from "@/components/CalendarioAlpha/lib/carregamento-compartilhadas";

const mensagens = {
  timeout: "A agenda demorou para responder.",
  falha: "Não foi possível carregar a agenda.",
};

describe("carregamento de agendas compartilhadas", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserva uma resposta concluída antes do limite", async () => {
    vi.useFakeTimers();
    await expect(
      aguardarResultadoCompartilhado(
        Promise.resolve({ success: true as const, data: ["evento"] }),
        mensagens,
      ),
    ).resolves.toEqual({ success: true, data: ["evento"] });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("converte uma exceção inesperada em erro seguro", async () => {
    await expect(
      aguardarResultadoCompartilhado(
        Promise.reject(new Error("token-secreto")),
        mensagens,
      ),
    ).resolves.toEqual({ success: false, error: mensagens.falha });
  });

  it("encerra uma operação que não responde dentro do tempo limite", async () => {
    vi.useFakeTimers();
    const pendente = new Promise<never>(() => undefined);
    const resultado = aguardarResultadoCompartilhado(
      pendente,
      mensagens,
    );

    await vi.advanceTimersByTimeAsync(TEMPO_LIMITE_AGENDAS_COMPARTILHADAS_MS);

    await expect(resultado).resolves.toEqual({
      success: false,
      error: mensagens.timeout,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aplica o limite à listagem e a cada origem remota do hook", () => {
    const fonte = readFileSync(
      join(
        process.cwd(),
        "src/components/CalendarioAlpha/lib/useAgendasCompartilhadas.ts",
      ),
      "utf8",
    );

    expect(fonte.match(/aguardarResultadoCompartilhado\(/g)).toHaveLength(3);
    expect(fonte).toContain("setCarregando(false)");
  });
});
