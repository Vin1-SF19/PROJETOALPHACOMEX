"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { alternarPermissaoColegas, type UsuarioPermissaoColegaDTO } from "@/actions/google-calendar-colegas";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

/** Admin-only: decide quem pode usar o botão de compartilhar agenda com colegas (adicionar/ser adicionado). */
export function PainelPermissoesColegas({
  open,
  onOpenChange,
  usuarios,
  onAtualizado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuarios: UsuarioPermissaoColegaDTO[];
  onAtualizado: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [emAndamento, setEmAndamento] = useState<number | null>(null);

  function alternar(userId: number, permitir: boolean) {
    setEmAndamento(userId);
    startTransition(async () => {
      await alternarPermissaoColegas(userId, permitir);
      setEmAndamento(null);
      onAtualizado();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Permissão de compartilhamento</SheetTitle>
          <SheetDescription>
            Só quem está liberado aqui pode usar o botão de adicionar a agenda de um colega. Qualquer colaborador
            ativo pode ser adicionado — liberado ou não — a permissão controla apenas quem pode adicionar, não
            quem pode ser alvo. Admin/CEO sempre tem acesso, independente desta lista.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
          {usuarios.map((usuario) => (
            <div key={usuario.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{usuario.nome}</p>
                <p className="truncate text-[11px] text-slate-500">{usuario.email}</p>
              </div>
              {usuario.role === "Admin" || usuario.role === "CEO" ? (
                <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> Sempre liberado
                </span>
              ) : emAndamento === usuario.id && isPending ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
              ) : (
                <Switch
                  checked={usuario.permitido}
                  onCheckedChange={(valor) => alternar(usuario.id, valor)}
                  aria-label={`Permitir compartilhamento de agenda para ${usuario.nome}`}
                />
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
