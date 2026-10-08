// @vitest-environment happy-dom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarioColeta from '@/app/PainelAlpha/AlphaCatcher/CalendarioColeta';
import { getTema } from '@/lib/temas';
let container: HTMLDivElement, root: Root;
function Tela() {
  const [value, setValue] = useState({ dataInicio: '2026-10-06', dataFinal: '2026-10-06' });
  return createElement(CalendarioColeta, { value, onChange: setValue, disabled: false, visual: getTema('rose') });
}
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T15:00:00Z'));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(Tela)));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });
async function dia(valor: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${valor}"]`)!;
  await act(async () => button.click());
}
describe('calendário da coleta', () => {
  it('aceita o último dia permitido e bloqueia dias recentes e futuros', async () => {
    const limite = container.querySelector<HTMLButtonElement>('button[aria-label="25/10/2026"]')!;
    const recente = container.querySelector<HTMLButtonElement>('button[aria-label="26/10/2026"]')!;
    expect(limite.disabled).toBe(false); expect(recente.disabled).toBe(true);
    await dia('25/10/2026'); await dia('25/10/2026'); await dia('26/10/2026');
    expect(container.querySelector('[role=status]')?.textContent).toBe('25/10/2026 até 25/10/2026');
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Próximo mês"]')?.disabled).toBe(true);
  });
  it('usa o tema nos dias e alterna os atalhos sem acumular janelas', async () => {
    await dia('15/10/2026'); await dia('15/10/2026');
    expect(container.querySelector('button[aria-pressed=true]')?.classList.contains('bg-rose-600')).toBe(true);
    const atalho = (meses: number) => Array.from(container.querySelectorAll('button')).find(b => b.textContent === `Janela de ${meses} meses`)!;
    await act(async () => atalho(3).click());
    expect(atalho(3).getAttribute('aria-pressed')).toBe('true');
    expect(atalho(3).classList.contains('bg-rose-600')).toBe(true);
    await act(async () => atalho(6).click());
    expect(atalho(3).getAttribute('aria-pressed')).toBe('false');
    expect(atalho(6).getAttribute('aria-pressed')).toBe('true');
    await act(async () => atalho(6).click());
    expect(atalho(6).getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[role=status]')?.textContent).toBe('15/10/2026 até 15/10/2026');
    expect(container.querySelectorAll('button[aria-label][aria-pressed=true]')).toHaveLength(1);
  });
  it('dois cliques no mesmo dia selecionam somente ele', async () => {
    await dia('15/10/2026'); await dia('15/10/2026');
    expect(container.querySelector('[role=status]')?.textContent).toBe('15/10/2026 até 15/10/2026');
    expect(container.querySelectorAll('button[aria-label][aria-pressed=true]')).toHaveLength(1);
  });
  it('seleciona intervalo também em ordem inversa', async () => {
    await dia('20/10/2026'); await dia('10/10/2026');
    expect(container.querySelector('[role=status]')?.textContent).toBe('10/10/2026 até 20/10/2026');
    expect(container.querySelectorAll('button[aria-label][aria-pressed=true]')).toHaveLength(11);
  });
  it('atalho usa o dia clicado e permite intervalo entre meses', async () => {
    await dia('15/10/2026');
    const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Janela de 6 meses')!;
    await act(async () => button.click());
    expect(container.querySelector('[role=status]')?.textContent).toBe('15/04/2026 até 15/10/2026');
    await dia('01/10/2026'); await dia('Mês anterior'); await dia('20/09/2026');
    expect(container.querySelector('[role=status]')?.textContent).toBe('20/09/2026 até 01/10/2026');
  });
});
