// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LoginTransitionProvider, useLoginTransition } from "@/components/login/LoginTransitionProvider";
const mocks = vi.hoisted(() => ({ update: vi.fn(), replace: vi.fn(), iniciar: vi.fn() }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ update: mocks.update }) }));
vi.mock("@/components/auth/SessaoResilienteProvider", () => ({ useRecuperacaoSessao: () => ({ iniciarConfirmacao: mocks.iniciar }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("framer-motion", () => ({ useMotionValue: () => ({ set: vi.fn() }) }));
vi.mock("@/components/login/useReducedMotion", () => ({ useReducedMotion: () => true }));
vi.mock("@/components/login/LoginPageTow", () => ({ LoginPageTow: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/login/LoginSuccessTransition", () => ({ LoginSuccessTransition: () => null }));
let root: Root;
let host: HTMLDivElement;
let transition: ReturnType<typeof useLoginTransition>;
function Probe() { const value = useLoginTransition(); React.useEffect(() => { transition = value; }, [value]); return h("output", null, value.phase); }
beforeEach(async () => {
  vi.useFakeTimers(); vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); root = createRoot(host);
  await act(async () => root.render(h(LoginTransitionProvider, { children: h(Probe) })));
});
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });
const allowed = { estadoAcesso: "PERMITIDO", acessoBloqueado: false, user: { id: "7" } };

it("arms the watchdog before a never-resolving update and ignores its late allowed result", async () => {
  let resolve!: (value: unknown) => void;
  mocks.update.mockImplementation(() => new Promise(r => { resolve = r; }));
  let confirmation!: Promise<void>;
  await act(async () => { transition.beginValidation(); });
  await act(async () => { confirmation = transition.confirmAuthenticated(); });
  expect(transition.phase).toBe("validating");
  await act(async () => { await vi.advanceTimersByTimeAsync(8_500); });
  expect(transition.phase).toBe("auth_error");
  expect(transition.isBlocking).toBe(false);
  await act(async () => { resolve(allowed); await confirmation; });
  expect(transition.phase).toBe("auth_error");
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("TEMP is not authenticated success even if a malformed response contains user", async () => {
  mocks.update.mockResolvedValue({ ...allowed, estadoAcesso: "INDISPONIVEL" });
  await act(async () => transition.beginValidation());
  await act(async () => { await transition.confirmAuthenticated(); });
  expect(transition.phase).toBe("auth_error");
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("a new attempt ignores the prior negative response and only accepts the current allowed proof", async () => {
  let oldResolve!: (value: unknown) => void;
  mocks.update.mockImplementationOnce(() => new Promise(r => { oldResolve = r; })).mockResolvedValueOnce(allowed);
  await act(async () => transition.beginValidation());
  let old!: Promise<void>;
  await act(async () => { old = transition.confirmAuthenticated(); });
  await act(async () => transition.reportAuthFailure("Tente novamente"));
  await act(async () => transition.beginValidation());
  await act(async () => { await transition.confirmAuthenticated(); });
  expect(transition.phase).toBe("authorized");
  await act(async () => { oldResolve({ estadoAcesso: "NEGADO", acessoBloqueado: true }); await old; });
  expect(transition.phase).toBe("authorized");
  expect(mocks.iniciar).toHaveBeenCalledTimes(2);
});
