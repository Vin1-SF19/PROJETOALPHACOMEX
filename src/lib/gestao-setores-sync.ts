"use client";

const CANAL = "painel-alpha:setores-atualizados:v1";
const CHAVE_STORAGE = "painel-alpha:setores-atualizados:v1";
const EVENTO_LOCAL = "painel-alpha:setores-atualizados";

export function assinarAtualizacaoSetores(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  let canal: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      canal = new BroadcastChannel(CANAL);
      canal.addEventListener("message", callback);
    }
  } catch {
    canal = null;
  }

  const aoStorage = (event: StorageEvent) => {
    if (event.key === CHAVE_STORAGE) callback();
  };
  window.addEventListener("storage", aoStorage);
  window.addEventListener(EVENTO_LOCAL, callback);

  return () => {
    canal?.close();
    window.removeEventListener("storage", aoStorage);
    window.removeEventListener(EVENTO_LOCAL, callback);
  };
}

export function notificarAtualizacaoSetores(): void {
  if (typeof window === "undefined") return;
  const mensagem = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  let notificadoPorCanal = false;

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const canal = new BroadcastChannel(CANAL);
      canal.postMessage(mensagem);
      canal.close();
      notificadoPorCanal = true;
    }
  } catch {
    // O evento local e o storage cobrem ambientes sem BroadcastChannel.
  }

  if (!notificadoPorCanal) {
    try {
      window.localStorage.setItem(CHAVE_STORAGE, mensagem);
    } catch {
      // A mudança do setor já foi salva; a invalidação não deve interromper a tela.
    }
  }
  window.dispatchEvent(new CustomEvent(EVENTO_LOCAL));
}
