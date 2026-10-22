import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, vi } from "vitest";
import { NotificacaoFlutuante } from "@/components/NotificacaoFlutuante";
import { useChamadoNotificacoes } from "@/store/useChamadoNotificacoes";

/** Run the real poller/store; mock only HTTP and session/server boundaries. */
export async function montarPollerChamados(snapshot: unknown) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  useChamadoNotificacoes.setState({ notificacoes: [], feedbacksPendentes: [] });
  const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify(snapshot), { headers: { "Content-Type": "application/json" } }));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(NotificacaoFlutuante)));
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  return {
    store: useChamadoNotificacoes,
    async recover(nextSnapshot = snapshot) {
      snapshot = nextSnapshot;
      const count = fetcher.mock.calls.length;
      await act(async () => window.dispatchEvent(new Event("alpha-checklist-recovery")));
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(count + 1));
    },
    async close() {
      await act(async () => root.unmount());
      host.remove();
      fetcher.mockRestore();
      useChamadoNotificacoes.setState({ notificacoes: [], feedbacksPendentes: [] });
    },
  };
}
