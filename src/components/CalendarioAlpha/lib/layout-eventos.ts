import { mesmodia } from "./datas";
import type { EventoExibicao } from "./tipos";

const MINUTOS_POR_DIA = 24 * 60;

export interface EventoPosicionado {
  evento: EventoExibicao;
  /** Percentual (0-100) do topo da grade do dia. */
  topoPercentual: number;
  /** Percentual (0-100) da altura, com um piso mínimo para eventos curtos ficarem clicáveis/legíveis. */
  alturaPercentual: number;
  /** Índice da coluna dentro do cluster de eventos sobrepostos. */
  coluna: number;
  /** Total de colunas do cluster ao qual este evento pertence. */
  totalColunas: number;
}

function minutosDesdeMeiaNoite(data: Date): number {
  return data.getHours() * 60 + data.getMinutes();
}

/**
 * Posiciona os eventos com horário de um único dia numa grade de 24h, dividindo em colunas
 * quando há sobreposição (particionamento de intervalos — mesmo espírito do algoritmo do
 * Google Calendar, simplificado: cada cluster de eventos que se tocam ganha N colunas iguais).
 */
export function calcularPosicoesEventosDoDia(dia: Date, eventos: EventoExibicao[]): EventoPosicionado[] {
  const doDia = eventos
    .filter((evento) => !evento.diaInteiro && evento.inicioEm && evento.fimEm && mesmodia(new Date(evento.inicioEm), dia))
    .map((evento) => ({
      evento,
      inicioMin: Math.max(0, minutosDesdeMeiaNoite(new Date(evento.inicioEm!))),
      fimMin: Math.min(MINUTOS_POR_DIA, Math.max(minutosDesdeMeiaNoite(new Date(evento.fimEm!)), 1)),
    }))
    .sort((a, b) => a.inicioMin - b.inicioMin || a.fimMin - b.fimMin);

  const resultado: EventoPosicionado[] = [];
  let clusterAtual: typeof doDia = [];
  let fimMaximoCluster = -1;

  function fecharCluster() {
    if (clusterAtual.length === 0) return;

    const colunas: number[] = []; // fimMin do último evento em cada coluna
    const colunaPorItem: number[] = [];

    for (const item of clusterAtual) {
      let colunaEncontrada = colunas.findIndex((fimColuna) => fimColuna <= item.inicioMin);
      if (colunaEncontrada === -1) {
        colunaEncontrada = colunas.length;
        colunas.push(item.fimMin);
      } else {
        colunas[colunaEncontrada] = item.fimMin;
      }
      colunaPorItem.push(colunaEncontrada);
    }

    const totalColunas = colunas.length;
    clusterAtual.forEach((item, indice) => {
      const alturaBruta = ((item.fimMin - item.inicioMin) / MINUTOS_POR_DIA) * 100;
      resultado.push({
        evento: item.evento,
        topoPercentual: (item.inicioMin / MINUTOS_POR_DIA) * 100,
        alturaPercentual: Math.max(alturaBruta, 2.5),
        coluna: colunaPorItem[indice],
        totalColunas,
      });
    });

    clusterAtual = [];
    fimMaximoCluster = -1;
  }

  for (const item of doDia) {
    if (clusterAtual.length > 0 && item.inicioMin >= fimMaximoCluster) {
      fecharCluster();
    }
    clusterAtual.push(item);
    fimMaximoCluster = Math.max(fimMaximoCluster, item.fimMin);
  }
  fecharCluster();

  return resultado;
}

export function eventosDiaInteiroDoDia(dia: Date, eventos: EventoExibicao[]): EventoExibicao[] {
  return eventos.filter((evento) => evento.diaInteiro && evento.inicioEm && mesmodia(new Date(evento.inicioEm), dia));
}
