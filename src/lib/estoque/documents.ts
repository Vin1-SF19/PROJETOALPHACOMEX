export const INVENTORY_INVOICE_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const DEFAULT_INVENTORY_INVOICE_MAX_BYTES = 8 * 1024 * 1024;
export const INVENTORY_INVOICE_OBJECT_KEY_MARKER = "/notas-fiscais/";

type InventoryInvoiceMetadata = { name?: string; type: string; size: number };

const EXTENSIONS: Record<(typeof INVENTORY_INVOICE_ALLOWED_TYPES)[number], string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

export function validateInventoryInvoiceMetadata(file: InventoryInvoiceMetadata): string | null {
  const mime = file.type.trim().toLowerCase() as (typeof INVENTORY_INVOICE_ALLOWED_TYPES)[number];
  if (!INVENTORY_INVOICE_ALLOWED_TYPES.includes(mime)) return "Use PDF, PNG, JPG/JPEG ou WebP.";
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return "O arquivo está vazio ou é inválido.";
  if (file.size > DEFAULT_INVENTORY_INVOICE_MAX_BYTES) return "A nota fiscal deve ter no máximo 8 MB.";
  if (file.name) {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!EXTENSIONS[mime].includes(extension)) return "A extensão não corresponde ao tipo do arquivo.";
  }
  return null;
}

export function hasValidInventoryInvoiceSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "application/pdf") return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  return type === "image/webp" && bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export function inventoryInvoiceObjectKey(itemId: string, type: string, nonce = crypto.randomUUID()): string {
  const safeItemId = itemId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
  const safeNonce = nonce.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
  if (!safeItemId || !safeNonce) throw new Error("Identificador inválido para a nota fiscal.");
  const extension = type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  return `estoque/itens/${safeItemId}/notas-fiscais/${safeNonce}.${extension}`;
}
