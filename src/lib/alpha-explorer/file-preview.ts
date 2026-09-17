export const MAX_INLINE_PREVIEW_BYTES = 100 * 1024 * 1024;

export type NativeOfficeApplication = "word" | "excel";

const OFFICE_APPLICATION_BY_EXTENSION: Readonly<Record<string, NativeOfficeApplication>> = {
  docx: "word",
  xlsx: "excel",
};

const PREVIEW_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  avif: "image/avif",
  bmp: "image/bmp",
  csv: "text/csv;charset=utf-8",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json;charset=utf-8",
  log: "text/plain;charset=utf-8",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  txt: "text/plain;charset=utf-8",
  wav: "audio/wav",
  webm: "video/webm",
  webp: "image/webp",
};

export function previewMimeType(fileName: string): string | null {
  const separator = fileName.lastIndexOf(".");
  if (separator <= 0 || separator === fileName.length - 1) return null;
  const extension = fileName.slice(separator + 1).toLocaleLowerCase("en-US");
  return PREVIEW_MIME_BY_EXTENSION[extension] ?? null;
}

export function nativeOfficeApplication(fileName: string): NativeOfficeApplication | null {
  if (isOfficeTemporaryFile(fileName)) return null;
  const separator = fileName.lastIndexOf(".");
  if (separator <= 0 || separator === fileName.length - 1) return null;
  return OFFICE_APPLICATION_BY_EXTENSION[fileName.slice(separator + 1).toLocaleLowerCase("en-US")] ?? null;
}

export function isOfficeTemporaryFile(fileName: string): boolean {
  return fileName.startsWith("~$");
}

export function canPreviewInline(fileName: string, sizeBytes: number | null): boolean {
  return previewMimeType(fileName) !== null
    && sizeBytes !== null
    && sizeBytes <= MAX_INLINE_PREVIEW_BYTES;
}

export async function createPreviewObjectUrl(response: Response, fileName: string): Promise<string> {
  const mimeType = previewMimeType(fileName);
  if (!mimeType) throw new Error("PREVIEW_UNSUPPORTED");
  const source = await response.blob();
  return URL.createObjectURL(new Blob([source], { type: mimeType }));
}
