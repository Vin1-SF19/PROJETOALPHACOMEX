import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ adicionar: vi.fn(), feedback: vi.fn(), audio: vi.fn(), dispatch: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), cleanup: undefined as undefined | (() => void) }));
vi.mock("react", () => ({ useRef: () => ({ current: false }), useEffect: (effect: () => (() => void) | undefined) => { mocks.cleanup = effect(); } }));
vi.mock("@/lib/pusher", () => ({ pusherClient: { subscribe: mocks.subscribe, unsubscribe: mocks.unsubscribe } }));
vi.mock("@/store/useChamadoNotificacoes", () => ({ useChamadoNotificacoes: (selector: (state: unknown) => unknown) => selector({ adicionarNotificacao: mocks.adicionar, adicionarFeedbackPendente: mocks.feedback }) }));

import { useChamadosNotifications } from "@/hooks/useAdminChamadosNotifications";
import { CHAMADOS_ADMIN_CHANNEL, NOVO_CHAMADO_EVENT, canalChamadosDoUsuario } from "@/lib/chamados/notificacoes";

describe("recepção de filas no realtime", () => {
  const canais = new Map<string, { handlers: Map<string, (payload: unknown) => void>; bind: ReturnType<typeof vi.fn>; unbind: ReturnType<typeof vi.fn> }>();
  beforeEach(() => {
    vi.clearAllMocks(); canais.clear();
    vi.stubGlobal("window", { dispatchEvent: mocks.dispatch });
    vi.stubGlobal("Audio", class { volume = 0; play() { mocks.audio(); return Promise.resolve(); } });
    mocks.subscribe.mockImplementation((nome: string) => {
      const handlers = new Map<string, (payload: unknown) => void>();
      const channel = { handlers, bind: vi.fn((evento: string, handler: (payload: unknown) => void) => handlers.set(evento, handler)), unbind: vi.fn() };
      canais.set(nome, channel); return channel;
    });
  });
  afterEach(() => { mocks.cleanup?.(); vi.unstubAllGlobals(); });
  const evento = { chamadoId: 15, titulo: "Reembolso", usuario: "Ana", usuarioId: 7, setor: "Comercial", urgencia: "MEDIA", createdAt: "2026-10-15T12:00:00Z" };

  it("colaborador comum recebe chamados pelo próprio canal", () => {
    useChamadosNotifications("Financeiro", 42);
    expect(canais.has(CHAMADOS_ADMIN_CHANNEL)).toBe(false);
    canais.get(canalChamadosDoUsuario(42))?.handlers.get(NOVO_CHAMADO_EVENT)?.(evento);
    expect(mocks.adicionar).toHaveBeenCalledWith(expect.objectContaining({ id: "novo-15", chamadoId: 15 }));
    expect(mocks.audio).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });

  it("deduplica notificação e som quando TI recebe pelos dois canais", () => {
    useChamadosNotifications("TI", 42);
    canais.get(CHAMADOS_ADMIN_CHANNEL)?.handlers.get(NOVO_CHAMADO_EVENT)?.(evento);
    canais.get(canalChamadosDoUsuario(42))?.handlers.get(NOVO_CHAMADO_EVENT)?.(evento);
    expect(mocks.adicionar).toHaveBeenCalledTimes(1);
    expect(mocks.audio).toHaveBeenCalledTimes(1);
  });

  it("ignora o próprio chamado", () => {
    useChamadosNotifications("TI", 42);
    canais.get(CHAMADOS_ADMIN_CHANNEL)?.handlers.get(NOVO_CHAMADO_EVENT)?.({ ...evento, usuarioId: 42 });
    expect(mocks.adicionar).not.toHaveBeenCalled();
    expect(mocks.audio).not.toHaveBeenCalled();
  });
});
