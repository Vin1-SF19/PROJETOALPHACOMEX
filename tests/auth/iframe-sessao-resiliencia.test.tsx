// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import { SessionProvider, useRecuperacaoSessao } from "@/components/auth/SessaoResilienteProvider";
import { SessaoProtegida } from "@/components/auth/SessaoIndisponivel";
import PainelLayoutClient from "@/components/layout/PainelLayoutClient";
import { getTabsStorageKey } from "@/lib/painel-tabs";
import { ALPHA_EMBED_READY, ALPHA_EMBED_PROTOCOL_VERSION } from "@/lib/painel-embedded";
vi.mock("next/navigation", () => ({ usePathname: () => "/PainelAlpha/AlphaCRM", useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next-auth/react", async original => ({ ...await original<typeof import("next-auth/react")>(), signOut: vi.fn(async () => undefined) }));
vi.mock("@/components/layout/GlobalSidebar", () => ({default:()=>null,SidebarMobileToggle:()=>null}));
vi.mock("@/components/layout/TabBar", () => ({ TabBar:()=>null }));
vi.mock("@/hooks/useSidebarState", () => ({useSidebarState:()=>({isCollapsed:false,isMobileOpen:false,toggleCollapse:vi.fn(),toggleMobile:vi.fn(),closeMobile:vi.fn()})}));
vi.mock("@/hooks/usePainelFrameLeaveGuard", () => ({usePainelFrameLeaveGuard:()=>vi.fn()}));
vi.mock("@/hooks/useAdminChamadosNotifications", () => ({useChamadosNotifications:()=>undefined}));
vi.mock("@/hooks/useChecklistNotifications", () => ({useChecklistNotifications:()=>undefined}));
vi.mock("@/hooks/useBpmCardNotificacaoNavigation", () => ({useBpmCardNotificacaoNavigation:()=>vi.fn()}));
vi.mock("@/hooks/useBpmTarefasNotifications", () => ({useBpmTarefasNotifications:()=>undefined}));
vi.mock("@/hooks/useNotasNotifications", () => ({useNotasNotifications:()=>undefined}));
vi.mock("@/hooks/useNotasLembretesPendentes", () => ({useNotasLembretesPendentes:()=>undefined}));
vi.mock("@/hooks/useCalendarioAlphaNotifications", () => ({useCalendarioAlphaNotifications:()=>undefined}));
vi.mock("@/hooks/useCsNpsNotifications", () => ({useCsNpsNotifications:()=>({autorizado:false,reconciliar:vi.fn()})}));
vi.mock("@/store/useNotasWorkspace", () => ({useNotasWorkspace:()=>false}));
vi.mock("@/components/chamados/NotificationToast", () => ({default:()=>null}));
vi.mock("@/components/chamados/ChamadoFinalizadoFeedbackDialog", () => ({ChamadoFinalizadoFeedbackDialog:()=>null}));
vi.mock("@/components/holerites/HoleriteNotificacaoGlobal", () => ({HoleriteNotificacaoGlobal:()=>null}));
vi.mock("@/components/Checklist/ChecklistNotificationToast", () => ({default:()=>null}));
vi.mock("@/components/BibbleChatHome/BibbleWeatherWidget", () => ({default:()=>null}));
vi.mock("@/components/layout/OnboardingModal", () => ({default:()=>null}));
vi.mock("@/components/Notas/NotesGlobalTaskbar", () => ({NotesGlobalTaskbar:()=>null}));
vi.mock("@/components/Notas/NotaNotificacaoToast", () => ({NotaNotificacaoToast:()=>null}));
vi.mock("@/components/CalendarioAlpha/CompromissoNotificacaoToast", () => ({CompromissoNotificacaoToast:()=>null}));
vi.mock("@/components/cs-nps/CsNpsPendenciasModal", () => ({CsNpsPendenciasModal:()=>null}));
vi.mock("@/components/layout/CentralNotificacoesPainel", () => ({CentralNotificacoesPainel:()=>null}));
vi.mock("@/components/chamados/ChamadosOperacionaisPainel", () => ({ChamadosOperacionaisPainel:()=>null}));
const allowed = { expires:"2026-12-01",estadoAcesso:"PERMITIDO",acessoBloqueado:false,user:{id:"7"} } as Session;
const temporary = { expires:"2026-12-01",estadoAcesso:"INDISPONIVEL",acessoBloqueado:false } as Session;
const denied = { expires:"2026-12-01",estadoAcesso:"NEGADO",acessoBloqueado:true } as Session;
const fetcher = vi.fn<typeof fetch>();
let root:Root, host:HTMLDivElement;
let recovery:ReturnType<typeof useRecuperacaoSessao>;
function Probe(){const value=useRecuperacaoSessao();React.useEffect(()=>{recovery=value},[value]);return h(SessaoProtegida,{children:h(PainelLayoutClient,{permissoes:["crm"],role:"User",userId:7,nome:"Controlado",children:null})})}
async function flush(){await act(async()=>{await vi.advanceTimersByTimeAsync(0)})}
async function mount(){await act(async()=>root.render(h(SessionProvider,{session:allowed,children:h(Probe)})));await flush()}
function loadedAtLogin(frame:HTMLIFrameElement){Object.defineProperty(frame,"contentWindow",{configurable:true,value:{location:{href:window.location.origin+"/"},postMessage:vi.fn()}});frame.dispatchEvent(new Event("load"));}
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();fetcher.mockReset();Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});vi.stubGlobal("fetch",fetcher);vi.stubGlobal("BroadcastChannel",undefined);localStorage.clear();localStorage.setItem(getTabsStorageKey(7),JSON.stringify({tabs:[{id:"tab-home",url:"/PainelAlpha",label:"IAlpha",pinned:true},{id:"tab-crm",url:"/PainelAlpha/AlphaCRM",label:"CRM"},{id:"tab-notas",url:"/PainelAlpha/Notas",label:"Notas"}],activeId:"tab-crm"}));host=document.createElement("div");root=createRoot(host)});
afterEach(async()=>{await act(async()=>root.unmount());vi.useRealTimers();vi.unstubAllGlobals();localStorage.clear()});
describe("actual shell iframe session confirmation",()=>{
 it("an iframe arriving at login confirms TEMP and preserves the other frame DOM/src/draft marker",async()=>{
  fetcher.mockResolvedValue(new Response(JSON.stringify(temporary)));
  await mount();const frames=Array.from(host.querySelectorAll("iframe"));expect(frames).toHaveLength(3);
  const notes=frames.find(frame=>frame.title==="Notas")!;const src=notes.src;notes.dataset.unsavedDraft="Ainda em edição";
  const crm=frames.find(frame=>frame.title==="CRM")!;
  await act(async()=>loadedAtLogin(crm));await flush();
  // The TEMP snapshot enables recovery, which may start one subsequent GET.
  expect(fetcher.mock.calls.filter(([url])=>url==="/api/auth/session").length).toBeLessThanOrEqual(2);
  expect(recovery.indisponivel).toBe(true);expect(signOut).not.toHaveBeenCalled();
  expect(host.querySelector('iframe[title="Notas"]')).toBe(notes);expect(notes.src).toBe(src);expect(notes.dataset.unsavedDraft).toBe("Ainda em edição");
  fetcher.mockResolvedValue(new Response(JSON.stringify(allowed)));await act(async()=>{await recovery.confirmar()});await flush();
  expect(host.querySelector('iframe[title="Notas"]')).toBe(notes);expect(host.querySelector('iframe[title="CRM"]')).toBe(crm);expect(notes.src).toBe(src);
 });
 it("ignores a wrong origin/source/frame attempt and retains the real 15s readiness deadline",async()=>{
  await mount();const frame=host.querySelector<HTMLIFrameElement>('iframe[title="CRM"]')!;
  const data={type:ALPHA_EMBED_READY,version:ALPHA_EMBED_PROTOCOL_VERSION,frameId:"tab-crm:0"};
  await act(async()=>{window.dispatchEvent(new MessageEvent("message",{origin:"https://external.invalid",source:frame.contentWindow,data}));window.dispatchEvent(new MessageEvent("message",{origin:window.location.origin,source:window,data}));window.dispatchEvent(new MessageEvent("message",{origin:window.location.origin,source:frame.contentWindow,data:{...data,frameId:"tab-crm:8"}}))});
  expect(frame.className).toContain("invisible");
  await act(async()=>{await vi.advanceTimersByTimeAsync(14_999)});expect(host.textContent).not.toContain("Tentar novamente");
  await act(async()=>{await vi.advanceTimersByTimeAsync(1)});expect(host.textContent).toContain("Tentar novamente");expect(fetcher).not.toHaveBeenCalled();
 });
 it("deduplicates concurrent iframe revocation hints into one server check and one logout",async()=>{
  let resolve!:(response:Response)=>void;fetcher.mockImplementation(()=>new Promise(r=>{resolve=r}));
  await mount();const frames=Array.from(host.querySelectorAll("iframe"));await act(async()=>{loadedAtLogin(frames[1]);loadedAtLogin(frames[2])});
  expect(fetcher).toHaveBeenCalledTimes(1);expect(signOut).not.toHaveBeenCalled();
  await act(async()=>{resolve(new Response(JSON.stringify(denied)))});await flush();expect(signOut).toHaveBeenCalledTimes(1);
 });
});
