// @vitest-environment happy-dom
// @vitest-environment-options {"happyDOM":{"settings":{"disableIframePageLoading":true}}}
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BuilderClient, BUILDER_URL, BUILDER_LOAD_TIMEOUT_MS } from '@/app/PainelAlpha/Builder/BuilderClient';
import { MODULOS_REGISTRY, podeVisualizarModulo } from '@/lib/modulos-registry';

const guards = vi.hoisted(() => ({ auth: vi.fn(), permissions: vi.fn() }));
vi.mock('@/../auth', () => ({ auth: guards.auth }));
vi.mock('@/actions/PermissoesSetor', () => ({ getPermissoesEfetivas: guards.permissions }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
import BuilderPage from '@/app/PainelAlpha/Builder/page';

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  (window as unknown as { happyDOM: { settings: { disableIframePageLoading: boolean } } }).happyDOM.settings.disableIframePageLoading = true;
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  guards.auth.mockReset();
  guards.permissions.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

async function render() { await act(async () => root.render(createElement(BuilderClient))); }

describe('Builder integrado ao painel', () => {
  it('registra rota, grupo e permissão administrável, com acesso restrito', () => {
    const builderModule = MODULOS_REGISTRY.find(item => item.id === 'builder')!;
    expect(builderModule).toMatchObject({ href: '/PainelAlpha/Builder', permission: 'builder', grupo: 'estudioConteudo', iconName: 'Globe' });
    expect(builderModule.adminOnly).toBeUndefined();
    expect(podeVisualizarModulo(builderModule, { role: 'Admin', permissoes: [] })).toBe(true);
    expect(podeVisualizarModulo(builderModule, { role: 'COMERCIAL', permissoes: ['builder'] })).toBe(true);
    expect(podeVisualizarModulo(builderModule, { role: 'COMERCIAL', permissoes: [] })).toBe(false);
  });
  it('protege a rota de sessão ausente, permissão ausente e falha de leitura', async () => {
    guards.auth.mockResolvedValue(null);
    await expect(BuilderPage()).rejects.toThrow('redirect:/');
    guards.auth.mockResolvedValue({ user: { id: '12', role: 'COMERCIAL' } });
    guards.permissions.mockResolvedValue([]);
    await expect(BuilderPage()).rejects.toThrow('redirect:/PainelAlpha');
    guards.permissions.mockRejectedValue(new Error('offline'));
    await expect(BuilderPage()).rejects.toThrow('redirect:/PainelAlpha');
  });
  it('permite admin e usuário autorizado', async () => {
    guards.auth.mockResolvedValue({ user: { id: '12', role: 'Admin' } });
    expect((await BuilderPage()).type).toBe('main');
    expect(guards.permissions).not.toHaveBeenCalled();
    guards.auth.mockResolvedValue({ user: { id: '12', role: 'COMERCIAL' } });
    guards.permissions.mockResolvedValue(['builder']);
    expect((await BuilderPage()).type).toBe('main');
    expect(guards.permissions).toHaveBeenCalledWith(12);
  });
  it('exibe loading, expira em 30s e retry remonta com novo prazo', async () => {
    await render();
    const first = container.querySelector('iframe')!;
    expect(first.src).toBe(BUILDER_URL);
    expect(first.src).toContain('/api/chatbotx/open');
    expect(container.querySelector('[role=status]')).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(BUILDER_LOAD_TIMEOUT_MS));
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Não foi possível carregar');
    expect(container.querySelector('iframe')).toBeNull();
    await act(async () => container.querySelector('button')!.click());
    expect(container.querySelector('iframe')).not.toBe(first);
    expect(container.querySelector('[role=status]')).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(BUILDER_LOAD_TIMEOUT_MS - 1));
    expect(container.querySelector('[role=alert]')).toBeNull();
  });
  it('load cancela prazo, mantém alternativa para bloqueio cross-origin e retry funciona', async () => {
    await render();
    const first = container.querySelector('iframe')!;
    await act(async () => first.dispatchEvent(new Event('load')));
    await act(async () => vi.advanceTimersByTime(BUILDER_LOAD_TIMEOUT_MS));
    expect(container.querySelector('[role=status]')).toBeNull();
    expect(container.querySelector('[role=alert]')).toBeNull();
    const link = container.querySelector('a')!;
    expect(link.href).toBe(BUILDER_URL);
    expect(link.href).toContain('/api/chatbotx/open');
    expect(link.rel).toBe('noopener noreferrer');
    expect(link.target).toBe('_blank');
    await act(async () => container.querySelector('button')!.click());
    expect(container.querySelector('iframe')).not.toBe(first);
  });
  it('trata perda de rede sem perder controles', async () => {
    await render();
    await act(async () => window.dispatchEvent(new Event('offline')));
    expect(container.querySelector('[role=alert]')).not.toBeNull();
    expect(container.querySelector('a')).not.toBeNull();
  });
});
