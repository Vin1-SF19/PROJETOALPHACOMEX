import { put } from "@vercel/blob/client";
import { z } from "zod";
const envelope = z.object({ ok: z.boolean(), data: z.unknown().optional(), error: z.object({ message: z.string() }).optional() });
const inicio = z.object({ recibo: z.string(), pathname: z.string(), clientToken: z.string(), access: z.literal("private") });
const finalizado = z.object({ recibo: z.string(), verificado: z.literal(true) });
async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const value = envelope.parse(await response.json());
  if (!response.ok || !value.ok) throw new Error(value.error?.message ?? "Não foi possível enviar o arquivo.");
  return value.data;
}
export function validarArquivoChecklist(file: Pick<File, "size" | "type">) {
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) throw new Error("Selecione um arquivo PDF, JPEG ou PNG.");
  if (file.size === 0 || file.size > 8 * 1024 * 1024) throw new Error("O arquivo deve ter até 8 MiB e não pode estar vazio.");
}
export async function uploadPrivadoChecklist(itemId: string, file: File) {
  validarArquivoChecklist(file);
  const token = inicio.parse(await post("/api/checklist/upload/iniciar", { itemId, nome: file.name, mime: file.type, tamanhoBytes: file.size }));
  await put(token.pathname, file, { access: token.access, token: token.clientToken, contentType: file.type });
  const result = finalizado.parse(await post("/api/checklist/upload/finalizar", { itemId, recibo: token.recibo }));
  return result.recibo;
}
