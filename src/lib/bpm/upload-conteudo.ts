import JSZip from "jszip";

/** Confere assinatura/estrutura sem extrair o conteúdo dos arquivos compactados. */
export async function conteudoUploadCompativel(buffer: ArrayBuffer, tipo: string): Promise<boolean> {
  const bytes = Buffer.from(buffer);
  const inicia = (hex: string) => bytes.subarray(0, hex.length / 2).equals(Buffer.from(hex, "hex"));
  if (tipo === "application/pdf") return bytes.subarray(0, 5).toString() === "%PDF-";
  if (tipo === "image/png") return inicia("89504e470d0a1a0a");
  if (tipo === "image/jpeg") return inicia("ffd8ff");
  if (tipo === "image/webp") return bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (tipo === "application/vnd.ms-excel") return inicia("d0cf11e0a1b11e1");
  if (tipo === "text/csv") {
    try {
      const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return texto.length > 0 && !/[\x00-\x08\x0e-\x1f]/.test(texto) && !/^\s*</.test(texto);
    } catch { return false; }
  }
  const entrada = tipo === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ? "word/document.xml" : tipo === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ? "xl/workbook.xml" : null;
  if (!entrada || !inicia("504b0304")) return false;
  try {
    const zip = await JSZip.loadAsync(buffer);
    return !!zip.file("[Content_Types].xml") && !!zip.file(entrada);
  } catch { return false; }
}
