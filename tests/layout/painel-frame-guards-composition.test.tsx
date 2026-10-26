// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PainelLayoutClient from '@/components/layout/PainelLayoutClient';
import { getTabsStorageKey, HOME_TAB_ID, HOME_URL, type PainelTab } from '@/lib/painel-tabs';
import { removePainelFrameState, retryPainelFrame } from '@/lib/painel-embedded';

// Only unrelated UI/notification boundaries are stubbed: the shell and BOTH leave
// hooks run unchanged, receive real messages, and control real iframe DOM nodes.
// Root provides recovery in the application. This leave-guard composition fixture
// isolates that auth boundary; protocol/session behavior has separate real tests.
vi.mock("@/components/layout/PainelVersionNotice", () => ({ PainelVersionNotice: () => null }));
vi.mock('@/components/auth/SessaoResilienteProvider', () => ({
  useRecuperacaoSessao: () => ({ confirmar: vi.fn(async () => null), sinalizarIndisponibilidade: vi.fn() }),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/PainelAlpha' }));
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/hooks/useSidebarState', () => ({ useSidebarState: () => ({ isCollapsed: false, isMobileOpen: false }) }));
vi.mock('@/hooks/useAdminChamadosNotifications', () => ({ useChamadosNotifications: vi.fn() }));
vi.mock('@/hooks/useChecklistNotifications', () => ({ useChecklistNotifications: vi.fn() }));
vi.mock('@/hooks/useBpmTarefasNotifications', () => ({ useBpmTarefasNotifications: vi.fn() }));
vi.mock('@/hooks/useBpmCardNotificacaoNavigation', () => ({ useBpmCardNotificacaoNavigation: vi.fn() }));
vi.mock('@/hooks/useNotasNotifications', () => ({ useNotasNotifications: vi.fn() }));
vi.mock('@/hooks/useNotasLembretesPendentes', () => ({ useNotasLembretesPendentes: vi.fn() }));
vi.mock('@/hooks/useCalendarioAlphaNotifications', () => ({ useCalendarioAlphaNotifications: vi.fn() }));
vi.mock('@/hooks/useCsNpsNotifications', () => ({ useCsNpsNotifications: () => ({ autorizado: false }) }));
vi.mock('@/store/useNotasWorkspace', () => ({ useNotasWorkspace: () => false }));
vi.mock('@/components/layout/GlobalSidebar', () => ({ default: () => null, SidebarMobileToggle: () => null }));
vi.mock('@/components/layout/TabBar', () => ({ TabBar: ({ tabs, onClose, onActivate }: {
  tabs: PainelTab[]; onClose: (id: string) => void; onActivate: (id: string) => void;
}) => <>{tabs.map(tab => <React.Fragment key={tab.id}>
  <button aria-label={`close ${tab.id}`} onClick={() => onClose(tab.id)} />
  <button aria-label={`activate ${tab.id}`} onClick={() => onActivate(tab.id)} />
</React.Fragment>)}</> }));
vi.mock('@/components/layout/PainelFrameFallback', () => ({ PainelFrameFallback: ({ onRetry }: { onRetry: () => void }) => <button aria-label="retry" onClick={onRetry} /> }));
vi.mock('@/components/chamados/NotificationToast', () => ({ default: () => null }));
vi.mock('@/components/chamados/ChamadoFinalizadoFeedbackDialog', () => ({ ChamadoFinalizadoFeedbackDialog: () => null }));
vi.mock('@/components/holerites/HoleriteNotificacaoGlobal', () => ({ HoleriteNotificacaoGlobal: () => null }));
vi.mock('@/components/Checklist/ChecklistNotificationToast', () => ({ default: () => null }));
vi.mock('@/components/BibbleChatHome/BibbleWeatherWidget', () => ({ default: () => null }));
vi.mock('@/components/layout/OnboardingModal', () => ({ default: () => null }));
vi.mock('@/components/Notas/NotesGlobalTaskbar', () => ({ NotesGlobalTaskbar: () => null }));
vi.mock('@/components/Notas/NotaNotificacaoToast', () => ({ NotaNotificacaoToast: () => null }));
vi.mock('@/components/CalendarioAlpha/CompromissoNotificacaoToast', () => ({ CompromissoNotificacaoToast: () => null }));
vi.mock('@/components/cs-nps/CsNpsPendenciasModal', () => ({ CsNpsPendenciasModal: () => null }));
vi.mock('@/components/layout/CentralNotificacoesPainel', () => ({ CentralNotificacoesPainel: () => null }));
vi.mock('@/components/chamados/ChamadosOperacionaisPainel', () => ({ ChamadosOperacionaisPainel: () => null }));
vi.mock('@/lib/painel-embedded', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/painel-embedded')>();
  return { ...original, removePainelFrameState: vi.fn(original.removePainelFrameState), retryPainelFrame: vi.fn(original.retryPainelFrame) };
});

const tabId = 'tab-checklist';
const checklistUrl = '/PainelAlpha/CheckList/primeiro';
const nextUrl = '/PainelAlpha/CheckList/segundo';
let host: HTMLDivElement, root: Root, frame: HTMLIFrameElement;
let draftDocument: Document;
let child: Window, post: ReturnType<typeof vi.fn>;
const origin = window.location.origin;
const storageKey = getTabsStorageKey(1);
type Operation = 'close' | 'retry' | 'reuse';
const stored = () => JSON.parse(localStorage.getItem(storageKey)!) as { tabs: PainelTab[]; activeId: string };
const currentFrame = () => host.querySelector<HTMLIFrameElement>('iframe[title="Checklist"]');
async function message(data: object) {
  await act(async () => { window.dispatchEvent(new MessageEvent('message', { data, origin, source: child })); });
}
async function announceCrm() {
  await message({ type: 'ALPHA_GUARD_STATE', version: 1, frameId: `${tabId}:0`, pending: true });
}
function request(type: string) {
  const payload = post.mock.calls.find(([data]) => data.type === type)?.[0] as { requestId: string } | undefined;
  expect(payload, `expected ${type}`).toBeDefined();
  return payload!;
}
async function crmResult(allowed: boolean) {
  await message({ type: 'ALPHA_LEAVE_RESULT', version: 1, frameId: `${tabId}:0`, requestId: request('ALPHA_LEAVE_REQUEST').requestId, allowed });
}
async function checklistResult(allowed: boolean) {
  await message({ type: allowed ? 'ALPHA_CHECKLIST_LEAVE_ALLOWED' : 'ALPHA_CHECKLIST_LEAVE_CANCELLED', requestId: request('ALPHA_CHECKLIST_REQUEST_LEAVE').requestId });
}
async function click(label: string) {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(button).not.toBeNull();
  await act(async () => button!.click());
}
async function run(operation: Operation, url = nextUrl) {
  if (operation === 'reuse') await message({ type: 'ALPHA_OPEN_TAB', url });
  else await click(operation === 'close' ? `close ${tabId}` : 'retry');
}
function expectPreserved() {
  expect(currentFrame()).toBe(frame);
  expect(frame.contentDocument).toBe(draftDocument);
  expect(draftDocument.querySelector('input')?.value).toBe('rascunho ainda não salvo');
  expect(frame.name).toBe(`alpha-panel-frame:${tabId}:0`);
  expect(new URL(frame.src).pathname).toBe(checklistUrl);
  expect(stored().tabs.find(tab => tab.id === tabId)?.url).toBe(checklistUrl);
  expect(removePainelFrameState).not.toHaveBeenCalled();
  expect(retryPainelFrame).not.toHaveBeenCalled();
}

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  localStorage.setItem(storageKey, JSON.stringify({ tabs: [
    { id: HOME_TAB_ID, url: HOME_URL, label: 'IAlpha', pinned: true },
    { id: tabId, url: checklistUrl, label: 'Checklist' },
  ], activeId: tabId }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<PainelLayoutClient permissoes={[]} role="ANALISTA" userId={1} nome="Teste">content</PainelLayoutClient>));
  frame = currentFrame()!;
  post = vi.fn();
  // Model the browser's same-origin child at the iframe boundary; DOM identity,
  // src, name, runtime attempts and persisted tabs remain owned by the real shell.
  draftDocument = document.implementation.createHTMLDocument();
  const draft = draftDocument.createElement('input'); draft.value = 'rascunho ainda não salvo'; draftDocument.body.append(draft);
  child = { postMessage: post, location: { href: origin + checklistUrl }, document: draftDocument } as unknown as Window;
  Object.defineProperty(frame, 'contentWindow', { configurable: true, value: child });
  Object.defineProperty(frame, 'contentDocument', { configurable: true, value: draftDocument });
  await announceCrm();
  await message({ type: 'ALPHA_CHECKLIST_DRAFT_STATE', blocked: true });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

describe.each<Operation>(['close', 'retry', 'reuse'])('shell composition: %s', operation => {
  it('waits for CRM; CRM refusal never reaches CheckList or mutates the frame', async () => {
    await run(operation);
    expectPreserved();
    expect(post.mock.calls.map(([data]) => data.type)).toEqual(['ALPHA_LEAVE_REQUEST']);
    await crmResult(false);
    expect(post.mock.calls.map(([data]) => data.type)).toEqual(['ALPHA_LEAVE_REQUEST']);
    expectPreserved();
  });
  it('CRM accepted then CheckList cancelled keeps the mounted frame and permits a fresh request', async () => {
    await run(operation); await crmResult(true);
    expect(post.mock.calls.map(([data]) => data.type)).toEqual(['ALPHA_LEAVE_REQUEST', 'ALPHA_CHECKLIST_REQUEST_LEAVE']);
    expectPreserved();
    await checklistResult(false); expectPreserved();
    post.mockClear(); await announceCrm(); await run(operation);
    expect(post.mock.calls.map(([data]) => data.type)).toEqual(['ALPHA_LEAVE_REQUEST']);
    expectPreserved();
  });
  it('executes the final mutation once only after both approvals, preserving pinned home', async () => {
    await run(operation); await run(operation);
    expect(post).toHaveBeenCalledOnce();
    await crmResult(true); expectPreserved();
    await checklistResult(true); await checklistResult(true);
    expect(stored().tabs.find(tab => tab.id === HOME_TAB_ID)?.pinned).toBe(true);
    if (operation === 'close') {
      expect(currentFrame()).toBeNull();
      expect(removePainelFrameState).toHaveBeenCalledOnce();
      expect(stored().activeId).toBe(HOME_TAB_ID);
    } else if (operation === 'retry') {
      expect(currentFrame()).not.toBe(frame);
      expect(currentFrame()?.name).toBe(`alpha-panel-frame:${tabId}:1`);
      expect(retryPainelFrame).toHaveBeenCalledOnce();
    } else {
      expect(currentFrame()).toBe(frame);
      expect(new URL(frame.src).pathname).toBe(nextUrl);
      expect(stored().tabs.filter(tab => tab.id === tabId)).toEqual([expect.objectContaining({ url: nextUrl })]);
    }
  });
});

it.each<Operation>(['close', 'retry', 'reuse'])('CRM timeout never reaches CheckList and preserves the iframe on %s', async operation => {
  vi.useFakeTimers(); await run(operation);
  await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
  expect(post.mock.calls.map(([data]) => data.type)).toEqual(['ALPHA_LEAVE_REQUEST']);
  expectPreserved();
});
it('same URL reuse skips CRM, waits for CheckList and keeps the same iframe without duplicate tabs', async () => {
  await run('reuse', checklistUrl);
  expect(post.mock.calls.map(([data]) => data.type)).toEqual(['ALPHA_CHECKLIST_REQUEST_LEAVE']);
  expectPreserved(); await checklistResult(true);
  expect(currentFrame()).toBe(frame);
  expect(stored().tabs).toHaveLength(2);
});
it('pinned home never invokes a leave guard or frame cleanup', async () => {
  await click(`close ${HOME_TAB_ID}`);
  expect(post).not.toHaveBeenCalled(); expectPreserved();
});

it('a different module without guard support opens and closes without opting into either protocol', async () => {
  await message({ type: 'ALPHA_OPEN_TAB', url: '/PainelAlpha/Notas', label: 'Notas' });
  const notes = stored().tabs.find(tab => tab.url === '/PainelAlpha/Notas')!;
  expect(host.querySelector('iframe[title="Notas"]')).not.toBeNull();
  await click(`close ${notes.id}`);
  expect(host.querySelector('iframe[title="Notas"]')).toBeNull();
  expect(post).not.toHaveBeenCalled();
  expect(currentFrame()).toBe(frame);
  expect(draftDocument.querySelector('input')?.value).toBe('rascunho ainda não salvo');
  expect(removePainelFrameState).toHaveBeenCalledExactlyOnceWith(expect.anything(), notes.id);
});
