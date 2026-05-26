const TZ = "America/Sao_Paulo";

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
