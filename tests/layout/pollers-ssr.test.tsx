// @vitest-environment node
import React, { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import BroadcastBanner from "@/components/BroadcastBanner";
import { Heartbeat } from "@/components/Heartbeat";
import { PainelVersionNotice } from "@/components/layout/PainelVersionNotice";
import { NotificacaoFlutuante } from "@/components/NotificacaoFlutuante";
import { useNotasWorkspaceSync } from "@/hooks/useNotasWorkspaceSync";
import { useNotasLembretesPendentes } from "@/hooks/useNotasLembretesPendentes";
import { useVoiceStatus } from "@/components/BibbleChatHome/useVoiceStatus";

const state = vi.hoisted(() => ({ mode: "unauthenticated" }));
vi.mock("next-auth/react", () => ({ useSession: () => ({
  status: state.mode === "allowed" || state.mode === "temporary" ? "authenticated" : state.mode,
  data: state.mode === "allowed" ? { estadoAcesso: "PERMITIDO", user: { id: "7" } }
    : state.mode === "temporary" ? { estadoAcesso: "INDISPONIVEL" } : null,
}) }));
vi.mock("@/components/auth/SessaoResilienteProvider", () => ({ useRecuperacaoSessao: () => ({ confirmar: vi.fn(), sinalizarIndisponibilidade: vi.fn() }) }));
vi.mock("@/actions/NotasWorkspace", () => ({ ObterWorkspaceNotas: vi.fn(), AtualizarWorkspaceNotas: vi.fn() }));
vi.mock("@/actions/NotasLembretes", () => ({ VerificarLembretesPendentes: vi.fn() }));
vi.mock("@/actions/checklist/eventos", () => ({ marcarEventoChecklistLido: vi.fn(), listarEventosChecklist: vi.fn() }));
function HookConsumers() {
  useNotasWorkspaceSync(7);
  useNotasLembretesPendentes(true);
  const voice = useVoiceStatus();
  return h("output", null, voice.loaded ? "loaded" : "waiting");
}
afterEach(() => vi.unstubAllGlobals());
it.each(["unauthenticated", "loading", "temporary", "allowed"])("server renders real pollers in %s state without window/document or network", (mode) => {
  state.mode = mode;
  expect(typeof window).toBe("undefined"); expect(typeof document).toBe("undefined");
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  try {
    const markup = renderToString(h(QueryClientProvider, { client, children: h(React.Fragment, null,
      h(BroadcastBanner), h(Heartbeat), h(PainelVersionNotice, { deployedCommitSha: "a".repeat(40) }),
      h(NotificacaoFlutuante), h(HookConsumers),
    ) }));
    expect(markup).toBe("<output>waiting</output>");
    expect(fetcher).not.toHaveBeenCalled();
  } finally { client.clear(); }
});
