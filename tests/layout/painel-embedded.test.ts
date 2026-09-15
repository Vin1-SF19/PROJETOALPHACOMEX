import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ALPHA_EMBED_LOADING,
  ALPHA_EMBED_PROTOCOL_VERSION,
  ALPHA_EMBED_READY,
  createPainelFrameId,
  createPainelFrameName,
  derivePainelEmbeddedUrl,
  getFrameIdFromPainelFrameName,
  getPainelFrameRuntimeState,
  isAlphaEmbedMessage,
  isPainelEmbeddedMarker,
  isPainelCanonicalUrl,
  isPainelIframeDestination,
  removePainelFrameState,
  retryPainelFrame,
  setPainelFrameStatus,
  type PainelFrameRuntimeByTab,
} from '@/lib/painel-embedded';

describe('contrato embedded do Painel Alpha', () => {
  it('deriva a URL do iframe sem alterar a URL canônica', () => {
    const canonicalUrl = '/PainelAlpha/Notas?id=nota-1#editor';
    const frameId = createPainelFrameId('tab-notas', 0);

    expect(derivePainelEmbeddedUrl(canonicalUrl, frameId)).toBe(
      '/PainelAlpha/Notas?id=nota-1&__alphaEmbedded=1&__alphaFrameId=tab-notas%3A0#editor',
    );
    expect(canonicalUrl).toBe('/PainelAlpha/Notas?id=nota-1#editor');
  });

  it('substitui marcadores reservados duplicados e aceita a home', () => {
    expect(
      derivePainelEmbeddedUrl(
        '/PainelAlpha?__alphaEmbedded=0&__alphaFrameId=antigo&__alphaEmbedded=1',
        'tab-home:2',
      ),
    ).toBe('/PainelAlpha?__alphaEmbedded=1&__alphaFrameId=tab-home%3A2');
  });

  it('rejeita URLs externas e identificadores inválidos', () => {
    expect(() => derivePainelEmbeddedUrl('https://example.com/PainelAlpha', 'tab-ok:0')).toThrow(
      'Apenas rotas internas',
    );
    expect(() => derivePainelEmbeddedUrl('/PainelAlpha', 'id com espaço')).toThrow(
      'Identificador',
    );
    expect(isPainelCanonicalUrl('/PainelAlpha/Agenda?dia=hoje')).toBe(true);
    expect(isPainelCanonicalUrl('//example.com/PainelAlpha')).toBe(false);
  });

  it('reconhece marcador e destino iframe sem tratá-los como autorização', () => {
    expect(isPainelEmbeddedMarker('1')).toBe(true);
    expect(isPainelEmbeddedMarker('true')).toBe(false);
    expect(isPainelIframeDestination('iframe')).toBe(true);
    expect(isPainelIframeDestination(' document ')).toBe(false);
  });

  it('valida tipo, versão e frameId do handshake', () => {
    expect(
      isAlphaEmbedMessage({
        type: ALPHA_EMBED_READY,
        version: ALPHA_EMBED_PROTOCOL_VERSION,
        frameId: 'tab-agenda:0',
      }),
    ).toBe(true);
    expect(
      isAlphaEmbedMessage({
        type: ALPHA_EMBED_LOADING,
        version: ALPHA_EMBED_PROTOCOL_VERSION,
        frameId: 'tab-agenda:0',
      }),
    ).toBe(true);
    expect(isAlphaEmbedMessage({ type: ALPHA_EMBED_READY, version: 2, frameId: 'tab:0' })).toBe(false);
    expect(isAlphaEmbedMessage({ type: ALPHA_EMBED_READY, version: 1, frameId: '../tab' })).toBe(false);
    expect(isAlphaEmbedMessage(null)).toBe(false);
  });

  it('mantém nome e frameId estáveis entre navegações da mesma iframe', () => {
    const frameId = createPainelFrameId('tab-crm', 3);
    expect(getFrameIdFromPainelFrameName(createPainelFrameName(frameId))).toBe(frameId);
    expect(getFrameIdFromPainelFrameName('frame-externo')).toBeNull();
    expect(createPainelFrameId('aba legada com espaço', 0)).toMatch(/^tab-[a-z0-9]+:0$/);
  });
});

describe('readiness independente por aba', () => {
  it('não libera outra aba e ignora mensagens de tentativa antiga', () => {
    let states: PainelFrameRuntimeByTab = {};
    states = setPainelFrameStatus(states, 'tab-a', 0, 'ready');

    expect(getPainelFrameRuntimeState(states, 'tab-a').status).toBe('ready');
    expect(getPainelFrameRuntimeState(states, 'tab-b').status).toBe('loading');

    states = retryPainelFrame(states, 'tab-a');
    expect(getPainelFrameRuntimeState(states, 'tab-a')).toEqual({ attempt: 1, status: 'loading' });
    expect(setPainelFrameStatus(states, 'tab-a', 0, 'ready')).toBe(states);
  });

  it('representa timeout, retry e fechamento sem afetar as demais abas', () => {
    let states: PainelFrameRuntimeByTab = {
      'tab-a': { attempt: 0, status: 'loading' },
      'tab-b': { attempt: 0, status: 'ready' },
    };

    states = setPainelFrameStatus(states, 'tab-a', 0, 'error');
    expect(getPainelFrameRuntimeState(states, 'tab-a').status).toBe('error');

    states = retryPainelFrame(states, 'tab-a');
    expect(getPainelFrameRuntimeState(states, 'tab-a')).toEqual({ attempt: 1, status: 'loading' });

    states = removePainelFrameState(states, 'tab-a');
    expect(states['tab-a']).toBeUndefined();
    expect(states['tab-b']).toEqual({ attempt: 0, status: 'ready' });
  });

  it('invalida uma aba pronta em novo load e só a libera com novo handshake', () => {
    let states: PainelFrameRuntimeByTab = {
      'tab-a': { attempt: 0, status: 'ready' },
    };

    states = setPainelFrameStatus(states, 'tab-a', 0, 'loading');
    expect(getPainelFrameRuntimeState(states, 'tab-a').status).toBe('loading');

    states = setPainelFrameStatus(states, 'tab-a', 0, 'ready');
    expect(getPainelFrameRuntimeState(states, 'tab-a').status).toBe('ready');
  });
});

describe('wiring server-side e segurança do handshake', () => {
  it('mantém auth antes do ramo embedded e valida origin/source no shell', () => {
    const root = process.cwd();
    const layout = readFileSync(join(root, 'src/app/PainelAlpha/layout.tsx'), 'utf8');
    const shell = readFileSync(join(root, 'src/components/layout/PainelLayoutClient.tsx'), 'utf8');
    const middleware = readFileSync(join(root, 'middleware.ts'), 'utf8');

    expect(layout.indexOf('await auth()')).toBeLessThan(layout.indexOf('if (isEmbedded)'));
    expect(layout.indexOf('!statusPermiteAcessoPainel(userRecord.status)')).toBeLessThan(
      layout.indexOf('if (isEmbedded)'),
    );
    expect(middleware).toContain('requestHeaders.delete(PAINEL_EMBED_HEADER)');
    expect(middleware).toContain('hasEmbeddedMarker || isIframeNavigation');
    expect(shell).toContain("event.origin !== window.location.origin || !isAlphaEmbedMessage(event.data)");
    expect(shell).toContain("iframe.contentWindow === event.source");
    expect(shell).toContain("message.frameId !== expectedFrameId");
    expect(shell).toContain("runtime.status === 'ready'");
    expect(shell).toContain("dataset.alphaEmbeddedReady === frameId");
  });
});
