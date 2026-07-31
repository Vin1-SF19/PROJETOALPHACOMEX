import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assinarInvalidacaoCalendarioAlpha,
  criarDedupeInvalidacaoCalendario,
  notificarCalendarioAlphaAlterado,
  resultadoToolAlterouCalendario,
} from "@/lib/google-calendar/invalidation";

describe("Calendar Alpha iframe invalidation", () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "BroadcastChannel");
    Reflect.deleteProperty(globalThis, "CustomEvent");
  });
  it("recognizes a successful Bibble calendar cancellation", () => {
    expect(
      resultadoToolAlterouCalendario(
        "cancelar_evento_calendario",
        JSON.stringify({ ok: true, cancelado: true }),
      ),
    ).toBe(true);
  });

  it("does not invalidate the agenda when the tool failed", () => {
    expect(
      resultadoToolAlterouCalendario(
        "cancelar_evento_calendario",
        JSON.stringify({ ok: false, erro: "Google indisponível" }),
      ),
    ).toBe(false);
  });

  it("ignores non-calendar tools and malformed results", () => {
    expect(
      resultadoToolAlterouCalendario(
        "buscar_clientes",
        JSON.stringify({ ok: true }),
      ),
    ).toBe(false);
    expect(
      resultadoToolAlterouCalendario("editar_evento_calendario", "invalid-json"),
    ).toBe(false);
  });

  it("deduplica a mesma mensagem recebida por múltiplas abas/canais", () => {
    let agora = 1_000;
    const aceitar = criarDedupeInvalidacaoCalendario(5_000, () => agora);

    expect(aceitar("1000:mensagem-1")).toBe(true);
    expect(aceitar({ id: "mensagem-1" })).toBe(false);

    agora += 5_001;
    expect(aceitar("6001:mensagem-1")).toBe(true);
  });

  it("assina/notifica via BroadcastChannel e DOM coalescendo IDs únicos", () => {
    vi.useFakeTimers();

    interface EventoFake {
      type: string;
      detail?: unknown;
      data?: unknown;
    }
    type Ouvinte = (evento: EventoFake) => void;
    const ouvintesWindow = new Map<string, Set<Ouvinte>>();
    const windowFake = {
      localStorage: { setItem: vi.fn() },
      addEventListener(tipo: string, ouvinte: Ouvinte) {
        const ouvintes = ouvintesWindow.get(tipo) ?? new Set<Ouvinte>();
        ouvintes.add(ouvinte);
        ouvintesWindow.set(tipo, ouvintes);
      },
      removeEventListener(tipo: string, ouvinte: Ouvinte) {
        ouvintesWindow.get(tipo)?.delete(ouvinte);
      },
      dispatchEvent(evento: EventoFake) {
        for (const ouvinte of ouvintesWindow.get(evento.type) ?? []) {
          ouvinte(evento);
        }
        return true;
      },
    };

    class CustomEventFake {
      readonly type: string;
      readonly detail: unknown;

      constructor(tipo: string, init?: { detail?: unknown }) {
        this.type = tipo;
        this.detail = init?.detail;
      }
    }

    class BroadcastChannelFake {
      static instancias = new Set<BroadcastChannelFake>();
      private readonly ouvintes = new Set<Ouvinte>();
      readonly name: string;

      constructor(nome: string) {
        this.name = nome;
        BroadcastChannelFake.instancias.add(this);
      }

      addEventListener(tipo: string, ouvinte: Ouvinte) {
        if (tipo === "message") this.ouvintes.add(ouvinte);
      }

      postMessage(data: unknown) {
        for (const instancia of BroadcastChannelFake.instancias) {
          if (instancia !== this && instancia.name === this.name) {
            for (const ouvinte of instancia.ouvintes) {
              ouvinte({ type: "message", data });
            }
          }
        }
      }

      close() {
        BroadcastChannelFake.instancias.delete(this);
      }
    }

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: windowFake,
    });
    Object.defineProperty(globalThis, "CustomEvent", {
      configurable: true,
      value: CustomEventFake,
    });
    Object.defineProperty(globalThis, "BroadcastChannel", {
      configurable: true,
      value: BroadcastChannelFake,
    });

    const callback = vi.fn();
    const cancelarAssinatura = assinarInvalidacaoCalendarioAlpha(callback);

    notificarCalendarioAlphaAlterado();
    notificarCalendarioAlphaAlterado();
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(windowFake.localStorage.setItem).toHaveBeenCalledTimes(2);

    cancelarAssinatura();
    notificarCalendarioAlphaAlterado();
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
