export function cleanBibbleSpeechText(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, " bloco de código ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[#*_>~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const speechRequests = new Map<string, Promise<Blob>>();

export function requestBibbleSpeech(messageId: string, text: string): Promise<Blob> {
  const existing = speechRequests.get(messageId);
  if (existing) return existing;

  const request = fetch("/api/bibble/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: "bibble", language: "pt" }),
  }).then(async response => {
    if (!response.ok) throw new Error("VOICE_UNAVAILABLE");
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("audio/wav")) throw new Error("INVALID_VOICE_RESPONSE");
    return response.blob();
  }).catch(error => {
    speechRequests.delete(messageId);
    throw error;
  });

  speechRequests.set(messageId, request);
  return request;
}

export function resetBibbleSpeechRequestsForTests(): void {
  speechRequests.clear();
}

export function releaseBibbleSpeech(messageId: string): void {
  speechRequests.delete(messageId);
}
