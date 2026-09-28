export function parseDateBR(value: unknown): string | null {
  if (!value || value === "N/A") return null;
  try {
    if (typeof value === "string") {
      const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
      if (br) {
        const [, dia, mes, ano, hora = "12", minuto = "00", segundo = "00"] = br;
        const dataBr = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto), Number(segundo));
        if (dataBr.getFullYear() === Number(ano) && dataBr.getMonth() === Number(mes) - 1 && dataBr.getDate() === Number(dia)) return dataBr.toISOString();
        return null;
      }
    }
    const data = new Date(value as string | number | Date);
    if (!Number.isNaN(data.getTime())) return data.toISOString();
  } catch {
    // Entrada inválida: o chamador persiste null.
  }
  return null;
}
