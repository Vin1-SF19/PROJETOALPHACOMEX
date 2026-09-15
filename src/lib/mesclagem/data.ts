const MILISSEGUNDOS_DIA = 86_400_000;
const ORIGEM_SERIAL_EXCEL_UTC = Date.UTC(1899, 11, 30);

function dataCivilValida(ano: number, mes: number, dia: number): boolean {
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

function formatarPartes(ano: number, mes: number, dia: number): string | null {
  if (!dataCivilValida(ano, mes, dia)) return null;
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${String(ano).padStart(4, "0")}`;
}

/** Normaliza datas civis sem carregar horário ou aplicar conversão de fuso. */
export function formatarDataMesclagem(valor: string): string {
  const texto = valor.trim();
  if (!texto) return "";

  const brasileira = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+.*)?$/.exec(texto);
  if (brasileira) {
    return formatarPartes(Number(brasileira[3]), Number(brasileira[2]), Number(brasileira[1])) ?? texto;
  }

  const iso = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[T\s].*)?$/.exec(texto);
  if (iso) {
    return formatarPartes(Number(iso[1]), Number(iso[2]), Number(iso[3])) ?? texto;
  }

  if (/^\d+(?:[.,]\d+)?$/.test(texto)) {
    const serial = Number(texto.replace(",", "."));
    if (Number.isFinite(serial) && serial >= 1 && serial <= 2_958_465) {
      const data = new Date(ORIGEM_SERIAL_EXCEL_UTC + Math.floor(serial) * MILISSEGUNDOS_DIA);
      return formatarPartes(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate()) ?? texto;
    }
  }

  return texto;
}
