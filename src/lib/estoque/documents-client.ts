import { validateInventoryInvoiceMetadata } from "@/lib/estoque/documents";

interface InvoiceResponse { success?: boolean; url?: string; error?: string }

async function readResponse(response: Response): Promise<InvoiceResponse> {
  return response.json().catch(() => ({})) as Promise<InvoiceResponse>;
}

export async function uploadInventoryInvoice(itemId: string, file: File): Promise<string> {
  const metadataError = validateInventoryInvoiceMetadata(file);
  if (metadataError) throw new Error(metadataError);
  const response = await fetch(`/api/estoque/itens/${encodeURIComponent(itemId)}/nota-fiscal`, {
    method: "POST",
    headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) },
    body: file,
  });
  const result = await readResponse(response);
  if (!response.ok || !result.success || !result.url) throw new Error(result.error || "Não foi possível enviar a nota fiscal.");
  return result.url;
}

export async function removeInventoryInvoice(itemId: string): Promise<void> {
  const response = await fetch(`/api/estoque/itens/${encodeURIComponent(itemId)}/nota-fiscal`, { method: "DELETE" });
  const result = await readResponse(response);
  if (!response.ok || !result.success) throw new Error(result.error || "Não foi possível remover a nota fiscal.");
}
