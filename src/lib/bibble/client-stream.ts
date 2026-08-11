export interface BibbleAppStreamEvent {
  type: string;
  text?: string;
  state?: string;
  message?: string;
  onyxSessionId?: string;
  finishReason?: string | null;
  truncated?: boolean;
  successful?: boolean;
}

export interface BibbleAppStreamResult {
  receivedAnyEvent: boolean;
  doneEvent: BibbleAppStreamEvent;
}

export class BibbleIncompleteStreamError extends Error {
  constructor(message = "O stream foi encerrado antes da confirmação de conclusão.") {
    super(message);
    this.name = "BibbleIncompleteStreamError";
  }
}

/**
 * Consome o protocolo SSE da aplicação. EOF físico não equivale a
 * sucesso: somente um evento `done` explícito e não marcado como falha conclui.
 */
export async function consumeBibbleAppStream(
  response: Response,
  onEvent: (event: BibbleAppStreamEvent) => void,
): Promise<BibbleAppStreamResult> {
  if (!response.ok || !response.body) throw new Error("API error");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedAnyEvent = false;
  let doneEvent: BibbleAppStreamEvent | null = null;

  const processFrame = (frame: string) => {
    const dataLines = frame
      .split("\n")
      .filter(line => line.startsWith("data: "))
      .map(line => line.slice(6));
    if (dataLines.length === 0) return;
    try {
      const event = JSON.parse(dataLines.join("\n")) as BibbleAppStreamEvent;
      receivedAnyEvent = true;
      onEvent(event);
      if (event.type === "done") doneEvent = event;
    } catch { /* frame malformado não confirma conclusão */ }
  };

  while (!doneEvent) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      processFrame(frame);
      if (doneEvent) break;
    }
  }

  if (!doneEvent) {
    buffer += decoder.decode();
    if (buffer.trim()) processFrame(buffer);
  }

  if (!doneEvent) throw new BibbleIncompleteStreamError();
  const completedEvent: BibbleAppStreamEvent = doneEvent;
  if (completedEvent.truncated === true) {
    throw new BibbleIncompleteStreamError(
      "A resposta atingiu o limite de saída e não foi concluída.",
    );
  }
  if (completedEvent.successful === false) {
    throw new BibbleIncompleteStreamError("O servidor marcou o stream como incompleto.");
  }

  return { receivedAnyEvent, doneEvent: completedEvent };
}
