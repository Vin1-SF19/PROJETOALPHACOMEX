const TZ = "America/Sao_Paulo";

/**
 * Converte o valor de um <input type="date"> ("YYYY-MM-DD", sem horário) para
 * um Date que representa meia-noite em São Paulo, não em UTC.
 *
 * `new Date("YYYY-MM-DD")` (ou `z.coerce.date()` sobre essa string) ancora em
 * meia-noite UTC — em qualquer fuso com offset negativo (Brasil = UTC-3), ao
 * exibir de volta isso já cai no dia anterior. É o motivo de "cadastrei dia 2,
 * salvou como dia 1". Brasil não observa mais horário de verão (abolido em
 * 2019), então o offset -03:00 é fixo e seguro o ano inteiro.
 */
export function parseDataLocalInput(valor: string): Date {
    return new Date(`${valor}T00:00:00-03:00`);
}

export function fmtDate(value: string | Date | null | undefined): string {
    if (!value) return "--";
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: TZ,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(value));
}

export function fmtTime(value: string | Date | null | undefined): string {
    if (!value) return "--";
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

export function fmtDateTime(value: string | Date | null | undefined): string {
    if (!value) return "--";
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: TZ,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

export function fmtTimeFull(value: string | Date | null | undefined): string {
    if (!value) return "--";
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date(value));
}

export function fmtDateLong(value: string | Date | null | undefined): string {
    if (!value) return "--";
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: TZ,
        weekday: "long",
        day: "2-digit",
        month: "long",
    }).format(new Date(value));
}
