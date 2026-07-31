"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { listarColegasVisiveis, listarEventosDeColega } from "@/actions/google-calendar-colegas";

import { calcularIntervaloVisao, type VisaoCalendario } from "./datas";
import type { ColegaAgendaView, EventoExibicao } from "./tipos";

interface UseAgendasCompartilhadasParams {
  visao: VisaoCalendario;
  dataReferenciaISO: string;
}

function chaveIntervalo(visao: VisaoCalendario, dataReferenciaISO: string): string {
  return `${visao}:${dataReferenciaISO}`;
}

export function useAgendasCompartilhadas({
  visao,
  dataReferenciaISO,
}: UseAgendasCompartilhadasParams) {
  const [colegas, setColegas] = useState<ColegaAgendaView[]>([]);
  const [eventos, setEventos] = useState<EventoExibicao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const parametrosAtuais = useRef({ visao, dataReferenciaISO });
  const carregamentoAtual = useRef<Promise<void> | null>(null);
  const intervaloCarregado = useRef<string | null>(null);
  const ativadoExplicitamente = useRef(false);
  parametrosAtuais.current = { visao, dataReferenciaISO };

  const carregar = useCallback(async function carregarCompartilhadas(): Promise<void> {
    ativadoExplicitamente.current = true;
    const parametros = parametrosAtuais.current;
    const chaveSolicitada = chaveIntervalo(parametros.visao, parametros.dataReferenciaISO);

    if (carregamentoAtual.current) {
      await carregamentoAtual.current;
      if (intervaloCarregado.current !== chaveIntervalo(
        parametrosAtuais.current.visao,
        parametrosAtuais.current.dataReferenciaISO,
      )) {
        await carregarCompartilhadas();
      }
      return;
    }

    const tarefa = (async () => {
      setCarregando(true);
      setErro(null);
      const colegasResultado = await listarColegasVisiveis();
      if (!colegasResultado.success) {
        setErro(colegasResultado.error);
        return;
      }

      setColegas(colegasResultado.data);
      const visiveis = colegasResultado.data.filter((colega) => colega.visivel);
      const dataReferencia = new Date(parametros.dataReferenciaISO);
      const { inicio, fim } = calcularIntervaloVisao(parametros.visao, dataReferencia);
      const resultados = await Promise.all(
        visiveis.map((colega) =>
          listarEventosDeColega(colega.colegaId, inicio.toISOString(), fim.toISOString()),
        ),
      );

      const falhas = resultados.flatMap((resultado, indice) =>
        resultado.success ? [] : [`${visiveis[indice]?.colega.nome ?? "Agenda compartilhada"}: ${resultado.error}`],
      );
      setEventos(
        resultados.flatMap((resultado) =>
          resultado.success
            ? resultado.data.map((evento) => ({
                id: evento.id,
                googleEventId: evento.googleEventId,
                status: evento.status,
                titulo: evento.titulo,
                inicioEm: evento.inicioEm,
                fimEm: evento.fimEm,
                diaInteiro: evento.diaInteiro,
                etag: evento.etag,
                linkMeet: evento.linkMeet,
                calendarioId: `colega-${evento.colegaId}`,
                calendarioGoogleId: evento.colegaEmail,
                calendarioNome: evento.colegaNome,
                calendarioCorHex: evento.cor,
                calendarioGravavel: evento.gravavel,
                colegaId: evento.colegaId,
              }))
            : [],
        ),
      );
      setErro(falhas.length > 0 ? falhas.join(" • ") : null);
    })().finally(() => {
      intervaloCarregado.current = chaveSolicitada;
      setCarregando(false);
      carregamentoAtual.current = null;
    });

    carregamentoAtual.current = tarefa;
    await tarefa;

    const chaveAtual = chaveIntervalo(
      parametrosAtuais.current.visao,
      parametrosAtuais.current.dataReferenciaISO,
    );
    if (ativadoExplicitamente.current && chaveAtual !== chaveSolicitada) {
      await carregarCompartilhadas();
    }
  }, []);

  useEffect(() => {
    if (!ativadoExplicitamente.current) return;
    const chaveAtual = chaveIntervalo(visao, dataReferenciaISO);
    if (intervaloCarregado.current !== chaveAtual) void carregar();
  }, [carregar, dataReferenciaISO, visao]);

  const recarregarSeAtivo = useCallback((): Promise<void> => {
    if (!ativadoExplicitamente.current) return Promise.resolve();
    return carregar();
  }, [carregar]);

  function atualizarVisibilidade(colegaId: number, visivel: boolean) {
    setColegas((atuais) =>
      atuais.map((colega) => colega.colegaId === colegaId ? { ...colega, visivel } : colega),
    );
    if (!visivel) {
      setEventos((atuais) => atuais.filter((evento) => evento.colegaId !== colegaId));
    }
  }

  return {
    colegas,
    eventos,
    erro,
    carregando,
    carregar,
    recarregarSeAtivo,
    substituirColegas: setColegas,
    atualizarVisibilidade,
  };
}
