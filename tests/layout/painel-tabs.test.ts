import { describe, expect, it } from 'vitest';

import {
  ensurePinnedHome,
  getTabsStorageKey,
  HOME_TAB_ID,
  HOME_URL,
  normalizeStoredTabs,
  parseStoredTabsState,
  type PainelTab,
} from '@/lib/painel-tabs';

const crmTab: PainelTab = {
  id: 'tab-crm',
  url: '/PainelAlpha/AlphaCRM',
  label: 'Alpha CRM',
};

const chamadosTab: PainelTab = {
  id: 'tab-chamados',
  url: '/PainelAlpha/Chamados',
  label: 'Chamados',
};

describe('persistência das abas do Painel Alpha', () => {
  it('isola a chave de armazenamento por usuário', () => {
    expect(getTabsStorageKey(7)).toBe('painel_alpha_tabs_v2_user_7');
    expect(getTabsStorageKey(8)).not.toBe(getTabsStorageKey(7));
    expect(() => getTabsStorageKey(0)).toThrow('userId inválido');
  });

  it('mantém a home canônica fixa e na primeira posição', () => {
    const tabs = ensurePinnedHome([
      crmTab,
      { id: 'home-antiga', url: HOME_URL, label: 'Início' },
      chamadosTab,
    ]);

    expect(tabs.map((tab) => tab.id)).toEqual([HOME_TAB_ID, 'tab-crm', 'tab-chamados']);
    expect(tabs[0]).toEqual({
      id: HOME_TAB_ID,
      url: HOME_URL,
      label: 'IAlpha',
      pinned: true,
    });
    expect(tabs.slice(1).every((tab) => tab.pinned === false)).toBe(true);
  });

  it('preserva a ordem válida e remove duplicatas ou URLs externas', () => {
    const tabs = normalizeStoredTabs([
      chamadosTab,
      crmTab,
      { ...crmTab, id: 'tab-crm-duplicada' },
      { id: 'tab-externa', url: 'https://example.com', label: 'Externa' },
      { id: '', url: '/PainelAlpha/Metas', label: 'Sem id' },
    ]);

    expect(tabs.map((tab) => tab.id)).toEqual([HOME_TAB_ID, 'tab-chamados', 'tab-crm']);
  });

  it('restaura a aba ativa quando ela ainda existe', () => {
    const restored = parseStoredTabsState(
      JSON.stringify({ tabs: [crmTab, chamadosTab], activeId: 'tab-chamados' }),
    );

    expect(restored?.tabs.map((tab) => tab.id)).toEqual([
      HOME_TAB_ID,
      'tab-crm',
      'tab-chamados',
    ]);
    expect(restored?.activeId).toBe('tab-chamados');
  });

  it('usa a home quando a aba ativa persistida não é válida', () => {
    const restored = parseStoredTabsState(
      JSON.stringify({ tabs: [crmTab], activeId: 'tab-inexistente' }),
    );

    expect(restored?.activeId).toBe(HOME_TAB_ID);
  });

  it('ignora payload ausente, inválido ou sem lista de abas', () => {
    expect(parseStoredTabsState(null)).toBeNull();
    expect(parseStoredTabsState('{invalido')).toBeNull();
    expect(parseStoredTabsState(JSON.stringify({ activeId: HOME_TAB_ID }))).toBeNull();
  });
});
