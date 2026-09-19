import sharp from "sharp";
import { DEFAULT_INVENTORY_IMAGE_MAX_BYTES } from "@/lib/estoque/images";

export const INVENTORY_IMAGE_MAX_DIMENSION = 1_600;
export const INVENTORY_IMAGE_MAX_INPUT_PIXELS = 24_000_000;
export const INVENTORY_IMAGE_OUTPUT_MIME = "image/webp";

const SHARP_FORMAT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

export class InventoryImageDecodeError extends Error {
  constructor(message = "A imagem está corrompida ou possui dimensões inválidas.") {
    super(message);
    this.name = "InventoryImageDecodeError";
  }
}

export interface PreparedInventoryImage {
  bytes: Buffer;
  mimeType: typeof INVENTORY_IMAGE_OUTPUT_MIME;
  width: number;
  height: number;
}

/** Decodifica de fato, limita pixels/dimensões e normaliza o arquivo antes do Blob. */
export async function prepareInventoryImageForStorage(
  bytes: Uint8Array,
  declaredMime: string,
): Promise<PreparedInventoryImage> {
  try {
    const input = sharp(Buffer.from(bytes), {
      failOn: "warning",
      limitInputPixels: INVENTORY_IMAGE_MAX_INPUT_PIXELS,
      animated: false,
    });
    const metadata = await input.metadata();
    const expectedFormat = SHARP_FORMAT_BY_MIME[declaredMime];
    if (!expectedFormat || metadata.format !== expectedFormat) {
      throw new InventoryImageDecodeError("O formato decodificado não corresponde ao tipo declarado.");
    }
    if (!metadata.width || !metadata.height || metadata.pages && metadata.pages > 1) {
      throw new InventoryImageDecodeError();
    }

    const result = await input
      .rotate()
      .resize({
        width: INVENTORY_IMAGE_MAX_DIMENSION,
        height: INVENTORY_IMAGE_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 84, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (!result.info.width || !result.info.height
      || result.info.width > INVENTORY_IMAGE_MAX_DIMENSION
      || result.info.height > INVENTORY_IMAGE_MAX_DIMENSION
      || result.data.byteLength > DEFAULT_INVENTORY_IMAGE_MAX_BYTES) {
      throw new InventoryImageDecodeError();
    }
    return {
      bytes: result.data,
      mimeType: INVENTORY_IMAGE_OUTPUT_MIME,
      width: result.info.width,
      height: result.info.height,
    };
  } catch (error) {
    if (error instanceof InventoryImageDecodeError) throw error;
    throw new InventoryImageDecodeError();
  }
}
