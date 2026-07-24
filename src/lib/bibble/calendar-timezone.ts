export const TIMEZONE_CALENDARIO_BIBBLE = "America/Sao_Paulo";

const ISO_DATA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

function parte(
  partes: Intl.DateTimeFormatPart[],
  tipo: Intl.DateTimeFormatPartTypes,
): string {
  return partes.find((item) => item.type === tipo)?.value ?? "";
}

export function formatarDataCalendarioParaBibble(
  valor: Date | string | null,
  diaInteiro: boolean,
): string | null {
  if (valor === null) return null;

  if (diaInteiro && typeof valor === "string" && ISO_DATA_CIVIL.test(valor)) {
    return valor;
  }

  const data = valor instanceof Date ? valor : new Date(valor);
  if (!Number.isFinite(data.getTime())) return null;

  if (diaInteiro) {
    return data.toISOString().slice(0, 10);
  }

  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_CALENDARIO_BIBBLE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  }).formatToParts(data);

  const nomeOffset = parte(partes, "timeZoneName");
  const offset = nomeOffset === "GMT" ? "+00:00" : nomeOffset.replace(/^GMT/, "");

  return (
    `${parte(partes, "year")}-${parte(partes, "month")}-${parte(partes, "day")}` +
    `T${parte(partes, "hour")}:${parte(partes, "minute")}:${parte(partes, "second")}` +
    offset
  );
}
