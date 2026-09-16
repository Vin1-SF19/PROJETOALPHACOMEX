import type { ExplorerItemView } from "./types";

export function formatSize(size: number | null): string {
  if (size === null) return "—";
  if (size < 1_024) return `${size} B`;
  if (size < 1_048_576) return `${(size / 1_024).toFixed(1)} KiB`;
  if (size < 1_073_741_824) return `${(size / 1_048_576).toFixed(1)} MiB`;
  return `${(size / 1_073_741_824).toFixed(2)} GiB`;
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatRelative(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `há ${weeks} sem`;
  return formatDate(value);
}

export type FileKind = "folder" | "pdf" | "sheet" | "word" | "slides" | "image" | "video" | "audio" | "archive" | "code" | "text" | "other";

const EXT: Record<string, FileKind> = {
  pdf: "pdf",
  xls: "sheet", xlsx: "sheet", xlsb: "sheet", ods: "sheet", csv: "sheet", tsv: "sheet",
  doc: "word", docx: "word", odt: "word", rtf: "word",
  ppt: "slides", pptx: "slides", odp: "slides", key: "slides",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image", bmp: "image", ico: "image", heic: "image", avif: "image", tiff: "image",
  mp4: "video", mov: "video", avi: "video", mkv: "video", webm: "video", m4v: "video", mpg: "video", wmv: "video",
  mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio", flac: "audio", aac: "audio",
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive", bz2: "archive",
  js: "code", jsx: "code", ts: "code", tsx: "code", json: "code", html: "code", css: "code", py: "code", java: "code", c: "code", cpp: "code", go: "code", rs: "code", sh: "code",
  txt: "text", md: "text", log: "text",
};

const MIME: Record<string, FileKind> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "sheet",
  "application/vnd.ms-excel": "sheet",
  "text/csv": "sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "slides",
  "application/vnd.ms-powerpoint": "slides",
  "image/png": "image", "image/jpeg": "image", "image/gif": "image", "image/webp": "image", "image/svg+xml": "image",
  "video/mp4": "video", "video/quicktime": "video", "video/webm": "video",
  "audio/mpeg": "audio", "audio/wav": "audio", "audio/ogg": "audio",
  "application/zip": "archive", "application/x-rar-compressed": "archive", "application/gzip": "archive",
  "text/plain": "text", "text/markdown": "text", "text/html": "code", "application/json": "code",
};

export function resolveFileKind(item: ExplorerItemView): FileKind {
  if (item.kind === "FOLDER") return "folder";
  const ext = (item.name.split(".").pop() ?? "").toLowerCase();
  if (EXT[ext]) return EXT[ext];
  if (item.validatedMime && MIME[item.validatedMime]) return MIME[item.validatedMime];
  return "other";
}

export function fileKindLabel(kind: FileKind): string {
  switch (kind) {
    case "folder": return "Pasta";
    case "pdf": return "Documento PDF";
    case "sheet": return "Planilha";
    case "word": return "Documento";
    case "slides": return "Apresentação";
    case "image": return "Imagem";
    case "video": return "Vídeo";
    case "audio": return "Áudio";
    case "archive": return "Arquivo compactado";
    case "code": return "Código";
    case "text": return "Texto";
    default: return "Arquivo";
  }
}
