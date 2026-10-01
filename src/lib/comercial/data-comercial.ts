/** Data comercial sem fuso: DateTime é apenas o recipiente, ancorado em UTC. */
export function parseDataComercial(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const data = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== value) return null;
    return data;
}

export function periodoComercialMensal(ano: number, mes: number) {
    if (!Number.isInteger(ano) || ano < 100 || ano > 9999 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        throw new Error("Período comercial inválido");
    }
    return { gte: new Date(Date.UTC(ano, mes - 1, 1)), lt: new Date(Date.UTC(ano, mes, 1)) };
}

/** Apenas o valor inicial do modal usa o calendário local do navegador. */
export function dataComercialHoje(agora = new Date()): string {
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

export function formatarDataComercial(value: string | Date): string {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}
