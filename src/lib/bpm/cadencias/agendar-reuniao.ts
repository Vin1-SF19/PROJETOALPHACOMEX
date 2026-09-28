import { formatarDataCivil } from "@/components/CalendarioAlpha/lib/datas";
import { datasUteisCicloNovosLeads } from "@/lib/bpm/novos-leads";

export type PassoLigacaoAgendar = {
  id: string;
  ordem: number;
  intervaloDias: number;
  tipoTarefa: string;
  titulo: string;
  descricao: string | null;
  prioridade: string;
};

/** Intervalos da cadência desta etapa são dias úteis desde o passo anterior. */
export function agendaLigacoesAgendar(inicio: Date, passos: PassoLigacaoAgendar[]) {
  const datas = datasUteisCicloNovosLeads(inicio);
  let indice = 0;
  let primeiro = true;
  return [...passos]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((passo) => {
      if (primeiro) {
        indice = Math.max(0, passo.intervaloDias);
        primeiro = false;
      } else {
        indice += Math.max(0, passo.intervaloDias);
      }
      if (passo.tipoTarefa !== "LIGACAO" || indice >= datas.length) return [];
      return [{ ...passo, dataCivil: datas[indice] }];
    });
}

export function agendaAgendarConcluida(inicio: Date, passos: PassoLigacaoAgendar[], ligacoes: Date[], agora: Date) {
  const agenda = agendaLigacoesAgendar(inicio, passos);
  if (!agenda.length || formatarDataCivil(agora) <= agenda[agenda.length - 1].dataCivil) return false;
  const diasRegistrados = new Set(ligacoes.filter((data) => data >= inicio).map(formatarDataCivil));
  return agenda.every((passo) => diasRegistrados.has(passo.dataCivil));
}
