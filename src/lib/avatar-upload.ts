export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_AVATAR_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_AVATAR_UPLOAD_BYTES = 1_500_000;
export const MAX_AVATAR_DIMENSION = 1024;

type AvatarMetadata = { type: string; size: number };

export function validateAvatarMetadata(
  file: AvatarMetadata,
  maxBytes = MAX_AVATAR_SOURCE_BYTES,
): string | null {
  if (!AVATAR_ALLOWED_TYPES.includes(file.type as (typeof AVATAR_ALLOWED_TYPES)[number])) {
    return "Use uma imagem JPEG, PNG ou WebP.";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return "A imagem está vazia ou inválida.";
  }
  if (file.size > maxBytes) {
    return `A imagem original deve ter no máximo ${Math.round(maxBytes / 1024 / 1024)} MB.`;
  }
  return null;
}

/** Confirma que os bytes iniciais correspondem ao MIME declarado. */
export function hasValidAvatarSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= png.length && png.every((value, index) => bytes[index] === value);
  }
  if (type === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

function nomeAvatarSeguro(nome: string): string {
  const base = nome
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "avatar"}.webp`;
}

async function carregarImagem(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasParaBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível preparar a imagem.")),
      "image/webp",
      quality,
    );
  });
}

/** Redimensiona e comprime no navegador para ficar abaixo do limite da função serverless. */
export async function prepareAvatarImage(file: File): Promise<{ blob: Blob; filename: string }> {
  const metadataError = validateAvatarMetadata(file);
  if (metadataError) throw new Error(metadataError);
  if (typeof document === "undefined") throw new Error("O processamento da imagem requer o navegador.");

  const image = await carregarImagem(file);
  const originalWidth = image.width;
  const originalHeight = image.height;
  if (!originalWidth || !originalHeight) throw new Error("A imagem não possui dimensões válidas.");

  const dimensionSteps = [MAX_AVATAR_DIMENSION, 768, 512];
  const qualities = [0.86, 0.72, 0.58];
  let smallest: Blob | null = null;

  for (const maxDimension of dimensionSteps) {
    const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Seu navegador não disponibilizou o processador de imagem.");
    context.drawImage(image, 0, 0, width, height);

    for (const quality of qualities) {
      const blob = await canvasParaBlob(canvas, quality);
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= MAX_AVATAR_UPLOAD_BYTES) {
        if ("close" in image && typeof image.close === "function") image.close();
        return { blob, filename: nomeAvatarSeguro(file.name) };
      }
    }
  }

  if ("close" in image && typeof image.close === "function") image.close();
  if (!smallest || smallest.size > MAX_AVATAR_UPLOAD_BYTES) {
    throw new Error("Não foi possível reduzir a foto para o tamanho permitido.");
  }
  return { blob: smallest, filename: nomeAvatarSeguro(file.name) };
}
