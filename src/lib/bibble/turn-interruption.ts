export type InterruptMessage = { role: 'user' | 'assistant'; streaming?: boolean };

export function interruptBibbleTurn<T extends InterruptMessage>(controller: AbortController | null, messages: T[]) {
  controller?.abort();
  const next = [...messages];
  if (next.at(-1)?.role === 'assistant' && next.at(-1)?.streaming) {
    next.pop();
    if (next.at(-1)?.role === 'user') next.pop();
  } else {
    return messages.map(message => message.streaming ? { ...message, streaming: false } : message);
  }
  return next;
}
