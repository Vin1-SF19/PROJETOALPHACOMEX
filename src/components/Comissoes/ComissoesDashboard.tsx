"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getTema } from "@/lib/temas";
import { CabecalhoComissoes } from "./Cabecalho/CabecalhoComissoes";
import { CardsIndicadores } from "./Indicadores/CardsIndicadores";
import { FiltrosComissoes, mesReferenciaAtual } from "./Filtros/FiltrosComissoes";
import { EventoComissaoCard } from "./EventoCard/EventoComissaoCard";
import { ModalDetalhesLancamento } from "./ModalDetalhes/ModalDetalhesLancamento";
import {
  CalcularIndicadoresComissao,
  ListarEventosComissao,
  type IndicadoresComissao,
} from "@/actions/CommissionDashboard";
import { BuscarEventoComLancamentos, type EventoComLancamentosResult } from "@/actions/CommissionEntries";

interface ComissoesDashboardProps {
  temaName: string;
}

const PAGE_SIZE = 25;

export function ComissoesDashboard({ temaName }: ComissoesDashboardProps) {
  const tema = getTema(temaName);

  const [eventosCompletos, setEventosCompletos] = useState<EventoComLancamentosResult[]>([]);
  const [indicadores, setIndicadores] = useState<IndicadoresComissao | null>(null);
  const [busca, setBusca] = useState("");
  const [mesReferencia, setMesReferencia] = useState<string | undefined>(mesReferenciaAtual);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [carregandoIndicadores, setCarregandoIndicadores] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [entryIdSelecionado, setEntryIdSelecionado] = useState<string | null>(null);

  const carregarEventos = useCallback(async () => {
    setCarregandoEventos(true);
    const resultado = await ListarEventosComissao({ page, pageSize: PAGE_SIZE, busca, mesReferencia });

    if (!resultado.success) {
      setErro(resultado.error);
      setCarregandoEventos(false);
      return;
    }

    setTotalPages(resultado.totalPages);
    setErro(null);

    const detalhes = await Promise.all(
      resultado.data.map((evento) => BuscarEventoComLancamentos({ eventId: evento.id })),
    );

    setEventosCompletos(
      detalhes
        .filter((r): r is Extract<typeof r, { success: true }> => r.success)
        .map((r) => r.data),
    );
    setCarregandoEventos(false);
  }, [page, busca, mesReferencia]);

  const carregarIndicadores = useCallback(async () => {
    setCarregandoIndicadores(true);
    const resultado = await CalcularIndicadoresComissao();
    if (resultado.success) {
      setIndicadores(resultado.data);
    }
    setCarregandoIndicadores(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregarEventos();
  }, [carregarEventos]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregarIndicadores();
  }, [carregarIndicadores]);

  function recarregarTudo() {
    void carregarEventos();
    void carregarIndicadores();
  }

  return (
    <div className="min-h-screen bg-[#020617] px-6 pb-24 pt-8 text-slate-200 md:px-8">
      <CabecalhoComissoes
        tema={tema}
        onSincronizado={recarregarTudo}
        totalDivergencias={indicadores?.totalDivergencias ?? 0}
      />

      <CardsIndicadores indicadores={indicadores} carregando={carregandoIndicadores} />

      <FiltrosComissoes
        onBuscaChange={(novaBusca) => {
          setBusca(novaBusca);
          setPage(1);
        }}
        onMesReferenciaChange={(novoMes) => {
          setMesReferencia(novoMes);
          setPage(1);
        }}
      />

      {erro && (
        <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          Não foi possível carregar os eventos.{" "}
          <code className="text-xs text-rose-400/80">{erro}</code>
        </div>
      )}

      {carregandoEventos ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-slate-500" aria-hidden="true" />
        </div>
      ) : eventosCompletos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-slate-500">
          <p>Nenhum evento de comissão encontrado.</p>
          <p className="text-xs">
            Clique em &quot;Sincronizar&quot; para importar dados do CS&amp;NPS e Alpha Metas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {eventosCompletos.map((dados) => (
            <EventoComissaoCard
              key={dados.event.id}
              dados={dados}
              tema={tema}
              onAbrirDetalhes={setEntryIdSelecionado}
              onAtualizar={recarregarTudo}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm text-slate-400">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40"
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}

      <ModalDetalhesLancamento
        entryId={entryIdSelecionado}
        onOpenChange={(open) => !open && setEntryIdSelecionado(null)}
        onAtualizar={recarregarTudo}
      />
    </div>
  );
}
