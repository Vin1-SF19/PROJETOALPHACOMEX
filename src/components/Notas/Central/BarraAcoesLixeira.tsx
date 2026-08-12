import { CheckSquare2, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BarraAcoesLixeiraProps {
  quantidadeNotas: number;
  quantidadeSelecionadas: number;
  modoSelecao: boolean;
  processando: boolean;
  onAtivarSelecao: () => void;
  onCancelarSelecao: () => void;
  onExcluirSelecionadas: () => void;
  onEsvaziarLixeira: () => void;
}

export function BarraAcoesLixeira({
  quantidadeNotas,
  quantidadeSelecionadas,
  modoSelecao,
  processando,
  onAtivarSelecao,
  onCancelarSelecao,
  onExcluirSelecionadas,
  onEsvaziarLixeira,
}: BarraAcoesLixeiraProps) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2">
      {modoSelecao ? (
        <>
          <button
            type="button"
            onClick={onCancelarSelecao}
            disabled={processando}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <X size={13} /> Cancelar
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={quantidadeSelecionadas === 0 || processando}
                className="flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={13} /> <span className="whitespace-nowrap">Excluir ({quantidadeSelecionadas})</span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir as notas selecionadas?</AlertDialogTitle>
                <AlertDialogDescription>
                  {quantidadeSelecionadas} nota{quantidadeSelecionadas === 1 ? " será removida" : "s serão removidas"} permanentemente. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onExcluirSelecionadas}>Excluir permanentemente</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <button
          type="button"
          onClick={onAtivarSelecao}
          disabled={quantidadeNotas === 0 || processando}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/5 disabled:opacity-40"
        >
          <CheckSquare2 size={13} /> Selecionar
        </button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={quantidadeNotas === 0 || processando}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-rose-400 transition-colors hover:bg-rose-500/10 disabled:opacity-40"
          >
            <Trash2 size={13} /> Esvaziar lixeira
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Esvaziar toda a lixeira?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as suas notas que estão na lixeira serão apagadas permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onEsvaziarLixeira}>Esvaziar permanentemente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

