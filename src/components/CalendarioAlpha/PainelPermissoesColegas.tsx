"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { alternarPermissaoColegas, type UsuarioPermissaoColegaDTO } from "@/actions/google-calendar-colegas";
import { Switch } from "@/components/ui/switch";
import type { TemaAlpha } from "@/lib/temas";

import { AgendaModal3D } from "./AgendaModal3D";

interface PainelPermissoesColegasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tema: TemaAlpha;
  usuarios: UsuarioPermissaoColegaDTO[];
  onAtualizado: () => void;
}

export function PainelPermissoesColegas({
  open,
  onOpenChange,
  tema,
  usuarios,
  onAtualizado,
}: PainelPermissoesColegasProps) {
  const [isPending, startTransition] = useTransition();
  const [emAndamento, setEmAndamento] = useState<number | null>(null);

  function alternar(userId: number, permitir: boolean) {
    setEmAndamento(userId);
    startTransition(async () => {
      const resultado = await alternarPermissaoColegas(userId, permitir);
      setEmAndamento(null);
      if (!resultado.success) {
        toast.error(resultado.error ?? "Não foi possível atualizar a permissão.");
        return;
      }
      onAtualizado();
    });
  }

  return (
    <AgendaModal3D
      open={open}
      onOpenChange={onOpenChange}
      tema={tema}
      title="Permissão de compartilhamento"
      description="Controle quem pode adicionar agendas de colegas. Admin e CEO permanecem sempre liberados."
      size="md"
    >
      <div className="space-y-2">
        {usuarios.map((usuario) => (
          <div key={usuario.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{usuario.nome}</p>
              <p className="truncate text-[11px] text-slate-500">{usuario.email}</p>
            </div>
            {usuario.role === "Admin" || usuario.role === "CEO" ? (
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-emerald-400">
                <ShieldCheck className="size-3.5" /> Sempre liberado
              </span>
            ) : emAndamento === usuario.id && isPending ? (
              <Loader2 className="size-4 animate-spin text-slate-500" />
            ) : (
              <Switch checked={usuario.permitido} onCheckedChange={(valor) => alternar(usuario.id, valor)} aria-label={`Permitir compartilhamento para ${usuario.nome}`} />
            )}
          </div>
        ))}
      </div>
    </AgendaModal3D>
  );
}
