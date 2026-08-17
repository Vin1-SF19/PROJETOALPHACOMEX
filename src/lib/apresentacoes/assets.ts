import { z } from "zod";

export const TIPOS_ASSET = ["IMAGEM", "VIDEO", "AUDIO", "MODELO_3D"] as const;
export const tipoAssetSchema = z.enum(TIPOS_ASSET);
export type TipoAsset = z.infer<typeof tipoAssetSchema>;

export const assetApresentacaoSchema = z.object({
  id: z.string().min(1),
  tipo: tipoAssetSchema,
  url: z.string().url(),
  nomeOriginal: z.string().min(1),
  tamanhoBytes: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type AssetApresentacao = z.infer<typeof assetApresentacaoSchema>;

export const ASSET_MAX_BYTES = 50 * 1024 * 1024;

const MIME_PARA_TIPO: Readonly<Record<string, TipoAsset>> = {
  "image/png": "IMAGEM",
  "image/jpeg": "IMAGEM",
  "image/webp": "IMAGEM",
  "image/gif": "IMAGEM",
  "video/mp4": "VIDEO",
  "video/webm": "VIDEO",
  "audio/mpeg": "AUDIO",
  "audio/wav": "AUDIO",
  "audio/x-wav": "AUDIO",
  "audio/ogg": "AUDIO",
  "model/gltf-binary": "MODELO_3D",
  "model/gltf+json": "MODELO_3D",
};

export function detectarTipoAsset(file: Pick<File, "name" | "type">): TipoAsset | null {
  const porMime = MIME_PARA_TIPO[file.type.toLowerCase()];
  if (porMime) return porMime;

  const extensao = file.name.split(".").pop()?.toLowerCase();
  if ((file.type === "application/octet-stream" || !file.type) && (extensao === "glb" || extensao === "gltf")) {
    return "MODELO_3D";
  }
  return null;
}

export function validarArquivoAsset(file: Pick<File, "name" | "type" | "size">): string | null {
  if (file.size <= 0) return "O arquivo está vazio.";
  if (file.size > ASSET_MAX_BYTES) return "O arquivo excede o limite de 50 MB.";
  if (!detectarTipoAsset(file)) return "Formato não permitido. Use PNG, JPG, WebP, GIF, MP4, WebM, MP3, WAV, OGG, GLB ou GLTF.";
  return null;
}

export function nomeArquivoSeguro(nome: string): string {
  return nome.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
}

export function formatarTamanhoAsset(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Envia um arquivo pro Blob Store da apresentação (`/api/apresentacoes/assets`) e devolve o
 * asset criado — pipeline único e compartilhado, usado tanto pela Biblioteca de Assets quanto
 * pelo upload direto de imagem no painel de propriedades do elemento. */
export async function enviarArquivoAsset(apresentacaoId: string, arquivo: File): Promise<AssetApresentacao> {
  const formData = new FormData();
  formData.set("apresentacaoId", apresentacaoId);
  formData.set("file", arquivo);
  const response = await fetch("/api/apresentacoes/assets", { method: "POST", body: formData });
  const payload: unknown = await response.json();
  if (!response.ok || typeof payload !== "object" || payload === null || !("asset" in payload)) {
    const mensagem = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
      ? payload.error : "Falha ao enviar arquivo.";
    throw new Error(mensagem);
  }
  const asset = assetApresentacaoSchema.safeParse(payload.asset);
  if (!asset.success) throw new Error("O servidor retornou um arquivo inválido.");
  return asset.data;
}
