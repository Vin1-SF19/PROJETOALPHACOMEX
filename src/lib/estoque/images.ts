export const INVENTORY_IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DEFAULT_INVENTORY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const INVENTORY_IMAGE_STORAGE_PROVIDER = "vercel-blob";

type InventoryImageMetadata = {
  name?: string;
  type: string;
  size: number;
};

const EXTENSION_BY_MIME: Record<(typeof INVENTORY_IMAGE_ALLOWED_TYPES)[number], string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

export function getInventoryImageMaxBytes(value = process.env.INVENTORY_IMAGE_MAX_BYTES): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_INVENTORY_IMAGE_MAX_BYTES;
}

export function validateInventoryImageMetadata(
  file: InventoryImageMetadata,
  maxBytes = DEFAULT_INVENTORY_IMAGE_MAX_BYTES,
): string | null {
  const mimeType = file.type.trim().toLowerCase();
  if (!INVENTORY_IMAGE_ALLOWED_TYPES.includes(mimeType as (typeof INVENTORY_IMAGE_ALLOWED_TYPES)[number])) {
    return "Use uma imagem PNG, JPG/JPEG ou WebP.";
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    return "A imagem está vazia ou inválida.";
  }
  if (file.size > maxBytes) {
    return `A imagem deve ter no máximo ${Math.ceil(maxBytes / 1024 / 1024)} MB.`;
  }

  if (file.name) {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const allowedExtensions = EXTENSION_BY_MIME[mimeType as keyof typeof EXTENSION_BY_MIME];
    if (!allowedExtensions.includes(extension)) {
      return "A extensão do arquivo não corresponde ao formato da imagem.";
    }
  }
  return null;
}

/** Confirma que o MIME declarado corresponde aos bytes iniciais do arquivo. */
export function hasValidInventoryImageSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (type === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export function inventoryImageExtension(type: string): "jpg" | "png" | "webp" {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export function inventoryImageObjectKey(itemId: string, type: string, nonce = crypto.randomUUID()): string {
  const safeItemId = itemId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
  if (!safeItemId) throw new Error("Item inválido para armazenamento da imagem.");
  const safeNonce = nonce.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
  if (!safeNonce) throw new Error("Identificador inválido para armazenamento da imagem.");
  return `estoque/itens/${safeItemId}/${safeNonce}.${inventoryImageExtension(type)}`;
}

export function isOptimizableInventoryImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}
