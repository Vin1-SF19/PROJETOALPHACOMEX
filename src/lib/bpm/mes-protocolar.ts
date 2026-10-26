export const MESES_PROTOCOLAR = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");

export function campoEhMesProtocolar(campo: { chave?: string | null; nome: string }): boolean {
  return ["alpha.radar.viabilidade.mes_protocolar", "alpha.mes.de.protocolo"].includes(campo.chave ?? "")
    || ["mes para protocolar", "mes de protocolo", "mes protocolo"].includes(normalizar(campo.nome));
}

/** Meses são nomes, sem ano/dia. Datas antigas são apenas interpretadas, sem escrever no banco. */
export function normalizarMesProtocolar(valor: string): typeof MESES_PROTOCOLAR[number] | null {
  const texto = valor.trim();
  const nome = MESES_PROTOCOLAR.find((mes) => normalizar(mes) === normalizar(texto));
  if (nome) return nome;
  let numero = /^\d{1,2}$/.test(texto) ? Number(texto) : 0;
  const periodo = /^(\d{4})-(\d{2})$/.exec(texto);
  const periodoBr = /^(\d{2})\/(\d{4})$/.exec(texto);
  if (periodo) numero = Number(periodo[2]);
  if (periodoBr) numero = Number(periodoBr[1]);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(texto);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (iso || br) {
    const dataIso = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : `${br![3]}-${br![2]}-${br![1]}`;
    const data = new Date(`${dataIso}T00:00:00.000Z`);
    if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== dataIso
      || (iso && !Number.isFinite(Date.parse(texto)))) return null;
    numero = Number((iso ?? br)![2]);
  }
  return numero >= 1 && numero <= 12 ? MESES_PROTOCOLAR[numero - 1] : null;
}
