/**
 * Parse defensivo de datas armazenadas como `String?` (não `DateTime`) em `clientes`
 * (CS&NPS). Mesmo cuidado já documentado em `architecture.md` para
 * `Transacao.dataOriginalTexto` — nunca assumir que a string sempre tem formato válido.
 */

export interface ParsedDateResult {
  date: Date | null;
  /** true quando havia uma string não-vazia mas que não pôde ser interpretada com confiança. */
  invalid: boolean;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Tenta interpretar uma data em formato ISO (YYYY-MM-DD...) ou brasileiro (DD/MM/YYYY).
 * Retorna `{ date: null, invalid: false }` para string vazia/nula (ausência legítima) e
 * `{ date: null, invalid: true }` para string presente mas não reconhecida (divergência).
 */
export function parseClienteDateString(value: string | null | undefined): ParsedDateResult {
  if (value === null || value === undefined || value.trim() === "") {
    return { date: null, invalid: false };
  }

  const trimmed = value.trim();

  if (ISO_DATE_RE.test(trimmed)) {
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return { date: d, invalid: false };
  }

  const brMatch = trimmed.match(BR_DATE_RE);
  if (brMatch) {
    const [, dia, mes, ano] = brMatch;
    const d = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
    if (!Number.isNaN(d.getTime())) return { date: d, invalid: false };
  }

  return { date: null, invalid: true };
}
