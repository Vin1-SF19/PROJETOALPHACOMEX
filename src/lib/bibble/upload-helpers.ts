import type { UploadedFile } from "@/components/BibbleChatHome/BibbleFileUpload";

export interface BibbleMessageWithFiles {
  message: string;
  files?: UploadedFile[];
}

/**
 * Prepara payload completo incluindo texto e arquivos
 */
export function prepareMessageWithFiles({ message, files }: BibbleMessageWithFiles) {
  // Filtra arquivos que estão prontos (não em upload e sem erro)
  const readyFiles = (files || []).filter(f => !f.uploading && !f.error);

  if (readyFiles.length === 0) {
    return { message, files: undefined };
  }

  // Converte arquivos prontos para formato de envio
  const filePayloads = readyFiles.map(f => {
    const base64 = !f.uploadUrl && f.previewUrl ? f.previewUrl.replace("blob:", "") : undefined;
    return {
      name: f.file.name,
      type: f.file.type || "application/octet-stream",
      size: f.file.size,
      url: f.uploadUrl,
      base64,
    };
  }).filter(f => f.base64 || f.url);

  return {
    message,
    files: filePayloads.length > 0 ? filePayloads : undefined,
  };
}

/**
 * Formata mensagens com arquivos para exibição
 */
export function formatMessageWithFiles({ message, files }: BibbleMessageWithFiles): string {
  if (!message && (!files || files.length === 0)) {
    return "";
  }

  const parts: string[] = [];

  if (message) {
    parts.push(message.trim());
  }

  if (files && files.length > 0) {
    const fileNames = files
      .filter(f => !f.uploading && !f.error)
      .map(f => `📎 ${f.file.name} (${formatFileSize(f.file.size)})`);

    if (fileNames.length > 0) {
      parts.push(`\nArquivos (${fileNames.length}):`);
      parts.push(...fileNames);
    }
  }

  return parts.join("\n");
}

/**
 * Formata tamanho para exibição legível
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Valida se arquivo pode ser processado
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/webm", "video/x-matroska",
    "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv", "application/json",
    "application/zip", "application/x-zip-compressed",
  ];

  if (file.type === "application/pdf") {
    return { valid: true, error: undefined };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "Tipo de arquivo não permitido" };
  }

  if (file.size > MAX_SIZE) {
    return { valid: false, error: "Arquivo muito grande (máx 10MB)" };
  }

  return { valid: true };
}
