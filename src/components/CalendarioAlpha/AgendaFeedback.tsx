import { Loader2 } from "lucide-react";

interface AgendaFeedbackProps {
  carregandoEdicao: boolean;
  carregandoPeriodo: boolean;
  erroPeriodo: string | null;
  erroEdicao: string | null;
  possuiAlvoEdicao: boolean;
  carregandoCompartilhadas: boolean;
  erroCompartilhadas: string | null;
  onRecarregarPeriodo: () => void;
  onRecarregarEdicao: () => void;
  onRecarregarCompartilhadas: () => void;
}

const estiloStatus = "mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs";
const estiloAlerta = `${estiloStatus} justify-between gap-3`;

export function AgendaFeedback({
  carregandoEdicao,
  carregandoPeriodo,
  erroPeriodo,
  erroEdicao,
  possuiAlvoEdicao,
  carregandoCompartilhadas,
  erroCompartilhadas,
  onRecarregarPeriodo,
  onRecarregarEdicao,
  onRecarregarCompartilhadas,
}: AgendaFeedbackProps) {
  return (
    <>
      {carregandoEdicao && (
        <div role="status" className={`${estiloStatus} border-white/10 bg-slate-950/70 text-slate-300`}>
          <Loader2 className="size-4 animate-spin" /> Carregando detalhes do evento…
        </div>
      )}
      {carregandoPeriodo && (
        <div role="status" className={`${estiloStatus} border-blue-400/20 bg-blue-500/10 text-blue-100`}>
          <Loader2 className="size-4 animate-spin" /> Atualizando este período em segundo plano…
        </div>
      )}
      {erroPeriodo && (
        <div role="alert" className={`${estiloAlerta} border-amber-500/30 bg-amber-500/10 text-amber-200`}>
          <span>{erroPeriodo} O último conteúdo disponível foi mantido.</span>
          <BotaoTentarNovamente onClick={onRecarregarPeriodo} />
        </div>
      )}
      {erroEdicao && possuiAlvoEdicao && (
        <div role="alert" className={`${estiloAlerta} border-rose-500/30 bg-rose-500/10 text-rose-200`}>
          <span>{erroEdicao}</span>
          <BotaoTentarNovamente onClick={onRecarregarEdicao} />
        </div>
      )}
      {carregandoCompartilhadas && (
        <div role="status" className={`${estiloStatus} border-white/10 bg-slate-950/70 text-slate-300`}>
          <Loader2 className="size-4 animate-spin" /> Atualizando agendas compartilhadas…
        </div>
      )}
      {erroCompartilhadas && (
        <div role="alert" className={`${estiloAlerta} border-amber-500/30 bg-amber-500/10 text-amber-200`}>
          <span>{erroCompartilhadas}</span>
          <BotaoTentarNovamente onClick={onRecarregarCompartilhadas} />
        </div>
      )}
    </>
  );
}

function BotaoTentarNovamente({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 font-bold underline underline-offset-4">
      Tentar novamente
    </button>
  );
}
