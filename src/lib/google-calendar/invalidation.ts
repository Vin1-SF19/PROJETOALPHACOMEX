export const CALENDARIO_ALPHA_INVALIDATION_KEY =
  "painel-alpha:calendario-alterado:v1";
export const CALENDARIO_ALPHA_INVALIDATION_EVENT =
  "painel-alpha:calendario-alterado";
export const CALENDARIO_ALPHA_INVALIDATION_CHANNEL =
  "painel-alpha:calendario-alterado:v1";

const TOOLS_MUTACAO_CALENDARIO = new Set([
  "criar_evento_calendario",
  "editar_evento_calendario",
  "cancelar_evento_calendario",
  "criar_evento_calendario_colega",
  "editar_evento_calendario_colega",
  "cancelar_evento_calendario_colega",
]);

export function resultadoToolAlterouCalendario(
  toolName: string,
  resultado: string,
): boolean {
  if (!TOOLS_MUTACAO_CALENDARIO.has(toolName)) return false;

  try {
    const dados = JSON.parse(resultado) as { ok?: unknown };
    return dados.ok === true;
  } catch {
    return false;
  }
}

function criarIdentificadorInvalidacao(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function extrairIdentificadorInvalidacao(valor: unknown): string | null {
  if (typeof valor === "string") {
    const separador = valor.indexOf(":");
    const id = separador >= 0 ? valor.slice(separador + 1) : valor;
    return id.trim() || null;
  }
  if (
    typeof valor === "object" &&
    valor !== null &&
    "id" in valor &&
    typeof valor.id === "string"
  ) {
    return valor.id.trim() || null;
  }
  return null;
}

/** Deduplica a mesma invalidação recebida por BroadcastChannel, storage e evento DOM. */
export function criarDedupeInvalidacaoCalendario(
  janelaMs = 5_000,
  agora: () => number = Date.now,
) {
  const vistos = new Map<string, number>();

  return (valor: unknown): boolean => {
    const id = extrairIdentificadorInvalidacao(valor);
    if (!id) return false;

    const instanteAtual = agora();
    for (const [idVisto, vistoEm] of vistos) {
      if (instanteAtual - vistoEm >= janelaMs) vistos.delete(idVisto);
    }

    if (vistos.has(id)) return false;
    vistos.set(id, instanteAtual);
    return true;
  };
}

/**
 * Assina invalidações entre abas/iframes. BroadcastChannel é o caminho principal;
 * `storage` e o evento DOM mantêm compatibilidade e cobrem navegadores sem suporte.
 */
export function assinarInvalidacaoCalendarioAlpha(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const aceitar = criarDedupeInvalidacaoCalendario();
  const janelaAgrupamentoMs = 100;
  let timerAgrupamento: ReturnType<typeof setTimeout> | null = null;
  const processar = (valor: unknown) => {
    if (!aceitar(valor)) return;
    if (timerAgrupamento) clearTimeout(timerAgrupamento);
    timerAgrupamento = setTimeout(() => {
      timerAgrupamento = null;
      callback();
    }, janelaAgrupamentoMs);
  };
  const aoEventoLocal = (evento: Event) => {
    const detalhe =
      typeof CustomEvent !== "undefined" && evento instanceof CustomEvent
        ? evento.detail
        : undefined;
    processar(detalhe ?? `legacy:${Date.now()}`);
  };
  const aoStorage = (evento: StorageEvent) => {
    if (evento.key === CALENDARIO_ALPHA_INVALIDATION_KEY) processar(evento.newValue);
  };

  let canal: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      canal = new BroadcastChannel(CALENDARIO_ALPHA_INVALIDATION_CHANNEL);
      canal.addEventListener("message", (evento) => processar(evento.data));
    }
  } catch {
    canal = null;
  }

  window.addEventListener("storage", aoStorage);
  window.addEventListener(CALENDARIO_ALPHA_INVALIDATION_EVENT, aoEventoLocal);

  return () => {
    if (timerAgrupamento) clearTimeout(timerAgrupamento);
    window.removeEventListener("storage", aoStorage);
    window.removeEventListener(CALENDARIO_ALPHA_INVALIDATION_EVENT, aoEventoLocal);
    canal?.close();
  };
}

/**
 * O painel mantém cada módulo em um iframe persistente. Alterar o localStorage
 * dispara `storage` nos outros iframes da mesma origem, inclusive na agenda oculta.
 */
export function notificarCalendarioAlphaAlterado(): void {
  if (typeof window === "undefined") return;

  const identificador = criarIdentificadorInvalidacao();
  const mensagem = `${Date.now()}:${identificador}`;

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const canal = new BroadcastChannel(CALENDARIO_ALPHA_INVALIDATION_CHANNEL);
      canal.postMessage(mensagem);
      canal.close();
    }
  } catch {
    // O fallback via storage/evento DOM continua disponível.
  }

  try {
    window.localStorage.setItem(
      CALENDARIO_ALPHA_INVALIDATION_KEY,
      mensagem,
    );
  } catch {
    // A mutação já foi concluída; indisponibilidade do storage não deve quebrar o chat.
  }

  try {
    window.dispatchEvent(
      new CustomEvent(CALENDARIO_ALPHA_INVALIDATION_EVENT, {
        detail: mensagem,
      }),
    );
  } catch {
    // Mantém o chat funcional mesmo em um ambiente sem suporte a eventos do DOM.
  }
}
