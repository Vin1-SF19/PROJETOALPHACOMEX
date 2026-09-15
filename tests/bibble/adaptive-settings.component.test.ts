import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import BibbleSettingsPanel from '@/components/BibbleChatHome/BibbleSettingsPanel';
import {
  DEFAULT_ADAPTIVE_PREFERENCES,
  adaptivePreferencesStorageKey,
  readAdaptivePreferences,
  type AdaptiveTonePreferences,
} from '@/lib/bibble/adaptive-style';

type ElementProps = Record<string, unknown> & { children?: ReactNode };

function walk(node: ReactNode, elements: ReactElement<ElementProps>[] = []): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) {
    node.forEach(child => walk(child, elements));
    return elements;
  }
  if (!isValidElement<ElementProps>(node)) return elements;
  elements.push(node);
  walk(node.props.children, elements);
  return elements;
}

function panel(preferences: AdaptiveTonePreferences, onChange = vi.fn()) {
  return createElement(BibbleSettingsPanel, {
    open: true,
    onClose: vi.fn(),
    isAdmin: false,
    temperature: 0.7,
    onTemperatureChange: vi.fn(),
    systemPrompt: '',
    onSystemPromptChange: vi.fn(),
    ollamaUrl: '',
    onOllamaUrlChange: vi.fn(),
    contextWindow: 131_072,
    onContextWindowChange: vi.fn(),
    computerAccess: false,
    onComputerAccessChange: vi.fn(),
    adaptivePreferences: preferences,
    onAdaptivePreferencesChange: onChange,
  });
}

describe('rendered Bibble adaptive settings', () => {
  it('renders keyboard-native controls with accessible labels', () => {
    const html = renderToStaticMarkup(panel(DEFAULT_ADAPTIVE_PREFERENCES));
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-label="Ativar tom adaptativo"');
    expect(html).toContain('aria-label="Nível de humor"');
    expect(html).toContain('aria-label="Reação à agressividade"');
    expect(html).toContain('aria-label="Nível de detalhe"');
    expect(html).not.toContain('tabindex="-1"');
  });

  it('changes all four controls and restores defaults through actual component handlers', () => {
    const onChange = vi.fn();
    const elements = walk(BibbleSettingsPanel({
      ...(panel(DEFAULT_ADAPTIVE_PREFERENCES).props as Parameters<typeof BibbleSettingsPanel>[0]),
      onAdaptivePreferencesChange: onChange,
    }));
    const byLabel = (label: string) => elements.find(element => element.props['aria-label'] === label)!;

    (byLabel('Ativar tom adaptativo').props.onClick as () => void)();
    (byLabel('Nível de humor').props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'moderate' } });
    (byLabel('Reação à agressividade').props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'neutral' } });
    (byLabel('Nível de detalhe').props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'short' } });
    const restore = elements.find(element => element.type === 'button' && element.props.children === 'Restaurar padrões de personalidade')!;
    (restore.props.onClick as () => void)();

    expect(onChange.mock.calls.map(call => call[0])).toEqual([
      { ...DEFAULT_ADAPTIVE_PREFERENCES, adaptiveTone: false },
      { ...DEFAULT_ADAPTIVE_PREFERENCES, humor: 'moderate' },
      { ...DEFAULT_ADAPTIVE_PREFERENCES, aggressionReaction: 'neutral' },
      { ...DEFAULT_ADAPTIVE_PREFERENCES, detail: 'short' },
      DEFAULT_ADAPTIVE_PREFERENCES,
    ]);
  });

  it('isolates persisted controls by userId', () => {
    const values = new Map<string, string>();
    values.set(adaptivePreferencesStorageKey(10), JSON.stringify({ ...DEFAULT_ADAPTIVE_PREFERENCES, humor: 'off' }));
    const storage = { getItem: (key: string) => values.get(key) ?? null };
    expect(readAdaptivePreferences(storage, 10).humor).toBe('off');
    expect(readAdaptivePreferences(storage, 11)).toEqual(DEFAULT_ADAPTIVE_PREFERENCES);
  });
});
