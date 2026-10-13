// Alguns textos RD vieram de UTF-8 interpretado como Latin-1/Windows-1252.
// Corrige apenas sequências completas e válidas, inclusive dentro de texto misto.
const cp1252 = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
  [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
  [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
  [0x017e, 0x9e], [0x0178, 0x9f],
]);
const byte = (char: string) => { const code = char.codePointAt(0)!; return code <= 0xff ? code : cp1252.get(code); };
const decoder = new TextDecoder("utf-8", { fatal: true });

export function textoLegivelRd(texto: string): string {
  let result = texto;
  for (let pass = 0; pass < 3; pass++) {
    const chars = Array.from(result);
    let next = "";
    for (let i = 0; i < chars.length; i++) {
      const first = byte(chars[i]);
      // Limitar às marcas usuais de codificação quebrada; letras latinas
      // corretas como Ó seguidas de espaço não separável não são uma marca.
      const length = first === 0xc2 || first === 0xc3 ? 2 : first === 0xe2 || first === 0xef ? 3 : first === 0xf0 ? 4 : 0;
      const bytes = chars.slice(i, i + length).map(byte);
      if (length && bytes.length === length && bytes.slice(1).every((b) => b !== undefined && b >= 0x80 && b <= 0xbf)) {
        try { next += decoder.decode(Uint8Array.from(bytes as number[])); i += length - 1; continue; }
        catch { /* Sequência inválida permanece como recebida, sem substituições destrutivas. */ }
      }
      next += chars[i];
    }
    if (next === result) break;
    result = next;
  }
  return result;
}
