export const TZ = "America/Sao_Paulo";

const DATA_HORA_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function partesEmSaoPaulo(data: Date): Record<string, string> {
    return Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
            timeZone: TZ,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        }).formatToParts(data).map((parte) => [parte.type, parte.value]),
    );
}

function offsetSaoPauloEmMilissegundos(data: Date): number {
    const nomeOffset = new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        timeZoneName: "longOffset",
    }).formatToParts(data).find((parte) => parte.type === "timeZoneName")?.value;
    const match = nomeOffset?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
    if (!match) return -3 * 60 * 60 * 1000;
    const sinal = match[1] === "+" ? 1 : -1;
    return sinal * (Number(match[2]) * 60 + Number(match[3])) * 60 * 1000;
}

/** Formata um instante persistido como valor civil do CRM em São Paulo. */
export function formatarDataHoraLocalBpm(value: string | Date | null | undefined): string {
    if (!value) return "";
    const data = new Date(value);
    if (Number.isNaN(data.getTime())) return "";
    const partes = partesEmSaoPaulo(data);
    return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
}

/**
 * Converte `YYYY-MM-DDTHH:mm` civil de São Paulo em instante sem depender do
 * fuso do navegador. Retorna null para datas impossíveis e valores parciais.
 */
export function parseDataHoraLocalBpm(value: string): Date | null {
    const match = DATA_HORA_LOCAL_RE.exec(value);
    if (!match) return null;
    const [, ano, mes, dia, hora, minuto] = match;
    const civilComoUtc = Date.UTC(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto));
    let candidato = new Date(civilComoUtc);
    candidato = new Date(civilComoUtc - offsetSaoPauloEmMilissegundos(candidato));
    candidato = new Date(civilComoUtc - offsetSaoPauloEmMilissegundos(candidato));
    return formatarDataHoraLocalBpm(candidato) === value ? candidato : null;
}

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
