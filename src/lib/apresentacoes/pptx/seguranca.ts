import type JSZip from "jszip";

export const PPTX_SECURITY_LIMITS = {
  maxEntries: 5000,
  maxXmlBytes: 16 * 1024 * 1024,
  maxExpandedBytes: 512 * 1024 * 1024,
  maxCompressionRatio: 200,
} as const;

function pathIsSafe(path: string): boolean {
  if (!path || path.startsWith("/") || path.startsWith("\\")) return false;
  const normalized = path.replace(/\\/g, "/");
  return !normalized.split("/").some((part) => part === ".." || part.includes("\0"));
}

/** Validação defensiva do pacote depois do diretório central ser lido, antes de parsear XML/assets. */
export function validarPacotePptx(zip: JSZip): void {
  const entries = Object.values(zip.files);
  if (entries.length > PPTX_SECURITY_LIMITS.maxEntries) throw new Error("PPTX excede o limite de entradas do pacote.");
  let expanded = 0;
  let compressed = 0;
  for (const entry of entries) {
    if (!pathIsSafe(entry.name)) throw new Error(`Caminho inseguro no PPTX: ${entry.name}`);
    const internal = entry as unknown as { _data?: { uncompressedSize?: number; compressedSize?: number } };
    const uncompressedSize = internal._data?.uncompressedSize ?? 0;
    const compressedSize = internal._data?.compressedSize ?? 0;
    expanded += uncompressedSize;
    compressed += compressedSize;
    if (/\.xml$/i.test(entry.name) && uncompressedSize > PPTX_SECURITY_LIMITS.maxXmlBytes) {
      throw new Error(`XML excede o limite permitido: ${entry.name}`);
    }
  }
  if (expanded > PPTX_SECURITY_LIMITS.maxExpandedBytes) throw new Error("PPTX excede o tamanho expandido permitido.");
  if (compressed > 0 && expanded / compressed > PPTX_SECURITY_LIMITS.maxCompressionRatio) {
    throw new Error("PPTX rejeitado por taxa de compressão suspeita (possível ZIP bomb).\n");
  }
}

