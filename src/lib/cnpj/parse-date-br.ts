export function parseDateBR(value: unknown): string | null {
  if (!value || value === "N/A") return null;
  try {
    const data = new Date(value as string | number | Date);
    if (!Number.isNaN(data.getTime())) return data.toISOString();
    if (typeof value === "string" && value.includes("/")) {
      const [dia, mes, ano] = value.split("/").map(Number);
      const dataBr = new Date(ano, mes - 1, dia, 12, 0, 0);
      if (!Number.isNaN(dataBr.getTime())) return dataBr.toISOString();
    }
  } catch {
    // Entrada inválida: o chamador persiste null.
  }
  return null;
}
