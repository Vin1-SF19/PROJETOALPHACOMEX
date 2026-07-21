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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

interface ColegaDisponivel {
  id: number;
  nome: string;
  email: string;
}

interface ColegaVisivel {
  colegaId: number;
  cor: string;
  visivel: boolean;
  colega: { id: number; nome: string; email: string };
}

export function PainelColegas({
  open,
  onOpenChange,
  tema,
  isAdmin,
  disponiveis,
  visiveis,
  onAtualizado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tema: TemaAlpha;
  isAdmin: boolean;
  disponiveis: ColegaDisponivel[];
  visiveis: ColegaVisivel[];
  onAtualizado: () => void;
}) {
  const [selecionado, setSelecionado] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [emAndamento, setEmAndamento] = useState<number | null>(null);

  function adicionar() {
    if (!selecionado) return;
    startTransition(async () => {
      const resultado = await adicionarColegaVisivel(Number(selecionado));
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Colega adicionado à sua visão.");
      setSelecionado("");
      onAtualizado();
    });
  }

  function alternar(colegaId: number, valor: boolean) {
    setEmAndamento(colegaId);
    startTransition(async () => {
      await alternarVisibilidadeColega(colegaId, valor);
      setEmAndamento(null);
      onAtualizado();
    });
  }

  function personalizarCor(colegaId: number, cor: string) {
    startTransition(async () => {
      await personalizarCorColega(colegaId, cor);
      onAtualizado();
    });
  }

  function remover(colegaId: number) {
    setEmAndamento(colegaId);
    startTransition(async () => {
      await removerColegaVisivel(colegaId);
      setEmAndamento(null);
      toast.success("Colega removido da sua visão.");
      onAtualizado();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Colegas</SheetTitle>
          <SheetDescription>Veja a agenda de colegas na sua grade, cada um com uma cor.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          {isAdmin && (
            <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
              <span>Como Admin/CEO, você pode editar/cancelar eventos dos colegas adicionados aqui, e também perguntar ao Bibble sobre a agenda de qualquer colaborador, mesmo sem adicionar.</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Select value={selecionado} onValueChange={setSelecionado}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={disponiveis.length ? "Escolher colaborador" : "Ninguém disponível"} />
              </SelectTrigger>
              <SelectContent>
                {disponiveis.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={adicionar} disabled={!selecionado || isPending} className={cn(tema.bg, "text-white")}>
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {visiveis.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-6">Nenhum colega adicionado ainda.</p>
            )}
            {visiveis.map((item) => (
              <div key={item.colegaId} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <input
                  type="color"
                  value={item.cor}
                  onChange={(e) => personalizarCor(item.colegaId, e.target.value)}
                  aria-label={`Cor da agenda de ${item.colega.nome}`}
                  title="Personalizar cor"
                  className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{item.colega.nome}</p>
                  <p className="truncate text-[11px] text-slate-500">{item.colega.email}</p>
                </div>
                {emAndamento === item.colegaId ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                ) : (
                  <>
                    <Switch
                      checked={item.visivel}
                      onCheckedChange={(valor) => alternar(item.colegaId, valor)}
                      aria-label={`Mostrar agenda de ${item.colega.nome}`}
                    />
                    <button
                      type="button"
                      onClick={() => remover(item.colegaId)}
                      aria-label={`Remover ${item.colega.nome}`}
                      title="Remover"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
