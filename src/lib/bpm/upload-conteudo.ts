/** Lê somente o diretório central ZIP, sem descompactar entradas. */
function estruturaOfficeValida(bytes: Buffer, entradaObrigatoria: string): boolean {
  const minimo = Math.max(0, bytes.length - 22 - 65_535);
  for (let fim = bytes.length - 22; fim >= minimo; fim -= 1) {
    if (bytes.readUInt32LE(fim) !== 0x06054b50) continue;
    if (fim + 22 + bytes.readUInt16LE(fim + 20) !== bytes.length) continue;
    const quantidade = bytes.readUInt16LE(fim + 10);
    const tamanhoDiretorio = bytes.readUInt32LE(fim + 12);
    const inicio = bytes.readUInt32LE(fim + 16);
    // Rejeita ZIP64 e diretórios enormes para limitar custo de validação.
    if (quantidade === 0 || quantidade > 3_000 || quantidade === 0xffff
      || tamanhoDiretorio > 8 * 1024 * 1024 || inicio + tamanhoDiretorio > fim) return false;
    let cursor = inicio;
    let tipos = false;
    let principal = false;
    const intervalosLocais: Array<{ inicio: number; fim: number }> = [];
    for (let indice = 0; indice < quantidade; indice += 1) {
      if (cursor + 46 > inicio + tamanhoDiretorio || bytes.readUInt32LE(cursor) !== 0x02014b50) return false;
      const flags = bytes.readUInt16LE(cursor + 8);
      const metodo = bytes.readUInt16LE(cursor + 10);
      const tamanhoComprimido = bytes.readUInt32LE(cursor + 20);
      const tamanhoOriginal = bytes.readUInt32LE(cursor + 24);
      const tamanhoNome = bytes.readUInt16LE(cursor + 28);
      const tamanhoExtra = bytes.readUInt16LE(cursor + 30);
      const tamanhoComentario = bytes.readUInt16LE(cursor + 32);
      const offsetLocal = bytes.readUInt32LE(cursor + 42);
      const proximo = cursor + 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
      if (proximo > inicio + tamanhoDiretorio || tamanhoNome === 0 || (flags & 1) !== 0
        || tamanhoComprimido === 0xffffffff || tamanhoOriginal === 0xffffffff
        || offsetLocal === 0xffffffff || offsetLocal + 30 > inicio
        || bytes.readUInt32LE(offsetLocal) !== 0x04034b50) return false;
      const tamanhoNomeLocal = bytes.readUInt16LE(offsetLocal + 26);
      const tamanhoExtraLocal = bytes.readUInt16LE(offsetLocal + 28);
      const fimDados = offsetLocal + 30 + tamanhoNomeLocal + tamanhoExtraLocal + tamanhoComprimido;
      if (tamanhoNomeLocal !== tamanhoNome || fimDados > inicio
        || bytes.readUInt16LE(offsetLocal + 6) !== flags
        || bytes.readUInt16LE(offsetLocal + 8) !== metodo
        || !bytes.subarray(offsetLocal + 30, offsetLocal + 30 + tamanhoNomeLocal)
          .equals(bytes.subarray(cursor + 46, cursor + 46 + tamanhoNome))) return false;
      intervalosLocais.push({ inicio: offsetLocal, fim: fimDados });
      const nome = bytes.toString("utf8", cursor + 46, cursor + 46 + tamanhoNome);
      if (nome === "[Content_Types].xml") tipos = true;
      if (nome === entradaObrigatoria) principal = true;
      cursor = proximo;
    }
    intervalosLocais.sort((a, b) => a.inicio - b.inicio);
    if (intervalosLocais.some((intervalo, indice) => indice > 0 && intervalo.inicio < intervalosLocais[indice - 1].fim)) return false;
    return cursor === inicio + tamanhoDiretorio && tipos && principal;
  }
  return false;
}

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
  return estruturaOfficeValida(bytes, entrada);
}

/** Para formatos simples, inspeciona só o cabeçalho; CSV é validado em streaming. */
export async function conteudoUploadDiretoCompativel(stream: ReadableStream<Uint8Array>, tipo: string, tamanho: number): Promise<boolean> {
  if (tamanho < 1) return false;
  if (tipo.endsWith(".document") || tipo.endsWith(".sheet")) {
    // OOXML exige conferir o diretório ZIP; nenhuma entrada é descompactada.
    const buffer = await new Response(stream).arrayBuffer();
    return buffer.byteLength === tamanho && conteudoUploadCompativel(buffer, tipo);
  }
  const reader = stream.getReader();
  const cabecalho: Uint8Array[] = [];
  let total = 0;
  const decodificador = tipo === "text/csv" ? new TextDecoder("utf-8", { fatal: true }) : null;
  let primeiroCaractereCsv: string | null = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > tamanho) return false;
      if (decodificador) {
        const texto = decodificador.decode(value, { stream: true });
        if (/[\x00-\x08\x0e-\x1f]/.test(texto)) return false;
        if (primeiroCaractereCsv === null) {
          const primeiro = texto.match(/\S/)?.[0];
          if (primeiro) primeiroCaractereCsv = primeiro;
          if (primeiroCaractereCsv === "<") return false;
        }
      } else {
        cabecalho.push(value);
        if (total >= 12) break;
      }
    }
    if (decodificador) {
      decodificador.decode();
      return total === tamanho && total > 0 && primeiroCaractereCsv !== "<";
    }
    const primeiros = Buffer.concat(cabecalho.map((parte) => Buffer.from(parte))).subarray(0, 12);
    return conteudoUploadCompativel(primeiros.buffer.slice(primeiros.byteOffset, primeiros.byteOffset + primeiros.byteLength), tipo);
  } catch {
    return false;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
