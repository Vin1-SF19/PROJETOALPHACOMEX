"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import {
  alternarVisibilidadeColega,
  personalizarCorColega,
  removerColegaVisivel,
} from "@/actions/google-calendar-colegas";
import {
  aprovarSolicitacao,
  recusarSolicitacao,
  solicitarCompartilhamento,
} from "@/actions/google-calendar-solicitacoes";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import { AgendaModal3D } from "./AgendaModal3D";
import { SeletorCorPaleta } from "./SeletorCorPaleta";
import { SeletorPapelCompartilhamento, type PapelCompartilhamento } from "./SeletorPapelCompartilhamento";
import type { ColegaAgendaView } from "./lib/tipos";

export interface SolicitacaoRecebidaView {
  id: string;
  papelPedido: string;
  createdAt: Date;
  solicitante: { id: number; nome: string; email: string };
}

const ROTULO_PAPEL: Record<"VISUALIZADOR" | "EDITOR", string> = {
  VISUALIZADOR: "Visualizador",
  EDITOR: "Editor",
};

interface PainelColegasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tema: TemaAlpha;
  isAdmin: boolean;
  disponiveis: { id: number; nome: string; email: string }[];
  visiveis: ColegaAgendaView[];
  solicitacoesRecebidas: SolicitacaoRecebidaView[];
  onAtualizado: () => void;
}

export function PainelColegas({
  open,
  onOpenChange,
  tema,
  isAdmin,
  disponiveis,
  visiveis,
  solicitacoesRecebidas,
  onAtualizado,
}: PainelColegasProps) {
  const [selecionado, setSelecionado] = useState("");
  const [papelPedido, setPapelPedido] = useState<PapelCompartilhamento>("VISUALIZADOR");
  const [isPending, startTransition] = useTransition();
  const [emAndamento, setEmAndamento] = useState<number | string | null>(null);

  function executar(acao: () => Promise<{ success: boolean; error?: string }>, mensagem?: string) {
    startTransition(async () => {
      const resultado = await acao();
      setEmAndamento(null);
      if (!resultado.success) {
        toast.error(resultado.error ?? "Não foi possível atualizar a agenda compartilhada.");
        return;
      }
      if (mensagem) toast.success(mensagem);
      onAtualizado();
    });
  }

  return (
    <AgendaModal3D
      open={open}
      onOpenChange={onOpenChange}
      tema={tema}
      title="Agendas compartilhadas"
      description="Peça acesso à agenda de um colega — ele precisa aprovar antes de aparecer na sua grade."
      size="md"
    >
      <div className="space-y-4">
        {isAdmin && (
          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-400">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
            <span>Mesmo Admin e CEO precisam pedir e esperar aprovação para ver a agenda de um colega.</span>
          </div>
        )}

        {solicitacoesRecebidas.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
              Pedidos para você ({solicitacoesRecebidas.length})
            </p>
            {solicitacoesRecebidas.map((solicitacao) => (
              <div key={solicitacao.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">{solicitacao.solicitante.nome}</p>
                  <p className="text-[10px] text-slate-500">
                    Quer ser {ROTULO_PAPEL[solicitacao.papelPedido as "VISUALIZADOR" | "EDITOR"]} da sua agenda
                  </p>
                </div>
                {emAndamento === solicitacao.id && isPending ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-slate-500" />
                ) : (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEmAndamento(solicitacao.id);
                        executar(() => aprovarSolicitacao(solicitacao.id), "Compartilhamento aprovado.");
                      }}
                      aria-label={`Aprovar pedido de ${solicitacao.solicitante.nome}`}
                      className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-400 hover:bg-emerald-500/25"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmAndamento(solicitacao.id);
                        executar(() => recusarSolicitacao(solicitacao.id), "Pedido recusado.");
                      }}
                      aria-label={`Recusar pedido de ${solicitacao.solicitante.nome}`}
                      className="rounded-lg bg-rose-500/15 p-1.5 text-rose-400 hover:bg-rose-500/25"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Select value={selecionado} onValueChange={setSelecionado}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={disponiveis.length ? "Escolher colaborador" : "Ninguém disponível"} />
              </SelectTrigger>
              <SelectContent>
                {disponiveis.map((colega) => <SelectItem key={colega.id} value={String(colega.id)}>{colega.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <SeletorPapelCompartilhamento value={papelPedido} onChange={setPapelPedido} />
            <Button
              type="button"
              disabled={!selecionado || isPending}
              className={cn(tema.bg, "text-white")}
              onClick={() => {
                if (!selecionado) return;
                executar(
                  () => solicitarCompartilhamento(Number(selecionado), papelPedido),
                  "Pedido enviado — aguardando aprovação.",
                );
                setSelecionado("");
              }}
              aria-label="Pedir acesso à agenda"
            >
              <UserPlus className="size-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Agendas que você vê</p>
          {visiveis.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhum colega adicionado ainda.</p>}
          {visiveis.map((item) => (
            <div key={item.colegaId} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] px-4 py-3">
              <SeletorCorPaleta
                corAtual={item.cor}
                onEscolher={(cor) => executar(() => personalizarCorColega(item.colegaId, cor))}
                label={`Cor da agenda de ${item.colega.nome}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{item.colega.nome}</p>
                <p className="truncate text-[11px] text-slate-500">{item.colega.email}</p>
              </div>
              <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-300">
                {ROTULO_PAPEL[item.papel]}
              </span>
              {emAndamento === item.colegaId ? <Loader2 className="size-4 animate-spin text-slate-500" /> : (
                <>
                  <Switch checked={item.visivel} onCheckedChange={(valor) => { setEmAndamento(item.colegaId); executar(() => alternarVisibilidadeColega(item.colegaId, valor)); }} aria-label={`Mostrar agenda de ${item.colega.nome}`} />
                  <button type="button" onClick={() => { setEmAndamento(item.colegaId); executar(() => removerColegaVisivel(item.colegaId), "Colega removido da grade."); }} aria-label={`Remover ${item.colega.nome}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400">
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </AgendaModal3D>
  );
}
