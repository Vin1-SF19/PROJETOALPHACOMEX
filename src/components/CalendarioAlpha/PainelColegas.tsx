"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  adicionarColegaVisivel,
  alternarVisibilidadeColega,
  personalizarCorColega,
  removerColegaVisivel,
} from "@/actions/google-calendar-colegas";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import { AgendaModal3D } from "./AgendaModal3D";
import type { ColegaAgendaView } from "./lib/tipos";

interface PainelColegasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tema: TemaAlpha;
  isAdmin: boolean;
  disponiveis: { id: number; nome: string; email: string }[];
  visiveis: ColegaAgendaView[];
  onAtualizado: () => void;
}

export function PainelColegas({
  open,
  onOpenChange,
  tema,
  isAdmin,
  disponiveis,
  visiveis,
  onAtualizado,
}: PainelColegasProps) {
  const [selecionado, setSelecionado] = useState("");
  const [isPending, startTransition] = useTransition();
  const [emAndamento, setEmAndamento] = useState<number | null>(null);

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
      description="Escolha colegas para exibir na grade e personalize cada cor."
      size="md"
    >
      <div className="space-y-4">
        {isAdmin && (
          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-400">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
            <span>Admin e CEO podem editar eventos de colegas adicionados à grade.</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Select value={selecionado} onValueChange={setSelecionado}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={disponiveis.length ? "Escolher colaborador" : "Ninguém disponível"} />
            </SelectTrigger>
            <SelectContent>
              {disponiveis.map((colega) => <SelectItem key={colega.id} value={String(colega.id)}>{colega.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            type="button"
            disabled={!selecionado || isPending}
            className={cn(tema.bg, "text-white")}
            onClick={() => {
              if (!selecionado) return;
              executar(() => adicionarColegaVisivel(Number(selecionado)), "Colega adicionado à sua grade.");
              setSelecionado("");
            }}
            aria-label="Adicionar colega"
          >
            <UserPlus className="size-4" />
          </Button>
        </div>
        <div className="space-y-2">
          {visiveis.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhum colega adicionado.</p>}
          {visiveis.map((item) => (
            <div key={item.colegaId} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] px-4 py-3">
              <input type="color" value={item.cor} onChange={(evento) => executar(() => personalizarCorColega(item.colegaId, evento.target.value))} aria-label={`Cor da agenda de ${item.colega.nome}`} className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{item.colega.nome}</p>
                <p className="truncate text-[11px] text-slate-500">{item.colega.email}</p>
              </div>
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
