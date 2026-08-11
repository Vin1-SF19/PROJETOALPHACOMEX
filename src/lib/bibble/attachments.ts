export interface SendableAttachment {
  uploading: boolean;
  error?: string;
  uploadUrl?: string;
}

export const BIBBLE_MAX_FILES_PER_TURN = 10;

export const BIBBLE_ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/webm", "video/quicktime",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "application/json",
] as const;

export const BIBBLE_ATTACHMENT_ACCEPT = BIBBLE_ALLOWED_ATTACHMENT_TYPES.join(",");

const allowedAttachmentTypes = new Set<string>(BIBBLE_ALLOWED_ATTACHMENT_TYPES);

export function isAllowedBibbleAttachmentType(type: string): boolean {
  return allowedAttachmentTypes.has(type);
}

export function selectAttachmentsWithinLimit<T>(
  current: readonly unknown[],
  incoming: readonly T[],
): T[] {
  const availableSlots = Math.max(0, BIBBLE_MAX_FILES_PER_TURN - current.length);
  return incoming.slice(0, availableSlots);
}

/**
 * Um anexo só pode participar do turno depois que o Blob confirmou sua URL.
 * A mesma regra é usada pela UI e pela guarda defensiva do layout.
 */
export function isAttachmentReady(file: SendableAttachment): boolean {
  return !file.uploading && !file.error && Boolean(file.uploadUrl?.trim());
}

export function areAttachmentsReady(files: SendableAttachment[]): boolean {
  return files.every(isAttachmentReady);
}

export function canSendBibbleMessage(input: {
  text: string;
  files: SendableAttachment[];
  isStreaming: boolean;
  disabled?: boolean;
}): boolean {
  const hasContent = input.text.trim().length > 0 || input.files.length > 0;
  return hasContent
    && areAttachmentsReady(input.files)
    && !input.isStreaming
    && !input.disabled;
}
