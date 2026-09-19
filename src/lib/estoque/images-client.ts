import { validateInventoryImageMetadata } from "@/lib/estoque/images";

interface InventoryImageResponse {
  success?: boolean;
  url?: string;
  error?: string;
}

async function readResponse(response: Response): Promise<InventoryImageResponse> {
  return response.json().catch(() => ({})) as Promise<InventoryImageResponse>;
}

export async function uploadInventoryItemImage(itemId: string, file: File): Promise<string> {
  const metadataError = validateInventoryImageMetadata(file);
  if (metadataError) throw new Error(metadataError);

  const response = await fetch(`/api/estoque/itens/${encodeURIComponent(itemId)}/imagem`, {
    method: "POST",
    headers: {
      "Content-Type": file.type,
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  const result = await readResponse(response);
  if (!response.ok || !result.success || !result.url) {
    throw new Error(result.error || "Não foi possível enviar a foto.");
  }
  return result.url;
}

export async function removeInventoryItemImage(itemId: string): Promise<void> {
  const response = await fetch(`/api/estoque/itens/${encodeURIComponent(itemId)}/imagem`, { method: "DELETE" });
  const result = await readResponse(response);
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Não foi possível remover a foto.");
  }
}
