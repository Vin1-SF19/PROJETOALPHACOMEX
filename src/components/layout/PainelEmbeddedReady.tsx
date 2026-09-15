'use client';

import { useEffect } from 'react';
import {
  ALPHA_EMBED_LOADING,
  ALPHA_EMBED_PROTOCOL_VERSION,
  ALPHA_EMBED_READY,
  getFrameIdFromPainelFrameName,
  isValidPainelFrameId,
  type AlphaEmbedMessage,
} from '@/lib/painel-embedded';

interface PainelEmbeddedReadyProps {
  frameId?: string | null;
}

export function PainelEmbeddedReady({ frameId: serverFrameId }: PainelEmbeddedReadyProps) {
  useEffect(() => {
    if (window.parent === window) return;

    const frameId = isValidPainelFrameId(serverFrameId)
      ? serverFrameId
      : getFrameIdFromPainelFrameName(window.name);
    if (!frameId) return;

    const notifyParent = (type: AlphaEmbedMessage['type']) => {
      const message: AlphaEmbedMessage = {
        type,
        version: ALPHA_EMBED_PROTOCOL_VERSION,
        frameId,
      };
      window.parent.postMessage(message, window.location.origin);
    };

    const notifyReady = () => {
      document.documentElement.dataset.alphaEmbeddedReady = frameId;
      notifyParent(ALPHA_EMBED_READY);
    };
    const notifyLoading = () => {
      delete document.documentElement.dataset.alphaEmbeddedReady;
      notifyParent(ALPHA_EMBED_LOADING);
    };

    if (document.readyState === 'complete') {
      notifyReady();
    } else {
      window.addEventListener('load', notifyReady, { once: true });
    }
    window.addEventListener('beforeunload', notifyLoading);

    return () => {
      window.removeEventListener('load', notifyReady);
      window.removeEventListener('beforeunload', notifyLoading);
    };
  }, [serverFrameId]);

  return null;
}
