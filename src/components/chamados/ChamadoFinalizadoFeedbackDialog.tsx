"use client";

import { CheckCircle2, Loader2, MessageCircleHeart, PartyPopper } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { recusarFeedbackChamadoAction } from "@/actions/chamados-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useChamadoNotificacoes, type ChamadoFeedbackPendente } from "@/store/useChamadoNotificacoes";
import { ChamadoFeedbackForm } from "./ChamadoFeedbackForm";

interface ChamadoFinalizadoFeedbackDialogProps {
  accent: string;
}

interface FeedbackPendenteDialogProps {
  feedback: ChamadoFeedbackPendente;
  totalNaFila: number;
  accent: string;
  onCompleted: () => void;
}

function FeedbackPendenteDialog({ feedback, totalNaFila, accent, onCompleted }: FeedbackPendenteDialogProps) {
  const [etapa, setEtapa] = useState<"convite" | "formulario">("convite");
  const [isPending, startTransition] = useTransition();

  function recusar() {
    startTransition(async () => {
      const resposta = await recusarFeedbackChamadoAction(feedback.chamadoId);
      if (!resposta.success) {
        toast.error(resposta.error ?? "Não foi possível registrar sua escolha.");
        return;
      }
      onCompleted();
    });
  }

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[2rem] border-white/10 bg-slate-950/95 p-0 text-white shadow-2xl backdrop-blur-2xl sm:max-w-xl"
      >
        <div className="relative overflow-hidden border-b border-white/5 px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 size-48 rounded-full blur-3xl" style={{ backgroundColor: `rgba(${accent}, 0.22)` }} />
          <DialogHeader className="relative text-left">
            <div className="mb-2 flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: `rgba(${accent}, 0.35)`, backgroundColor: `rgba(${accent}, 0.16)` }}>
                {etapa === "convite" ? <PartyPopper className="size-5" style={{ color: `rgb(${accent})` }} aria-hidden="true" /> : <MessageCircleHeart className="size-5" style={{ color: `rgb(${accent})` }} aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-black uppercase tracking-tight">{etapa === "convite" ? "Chamado finalizado" : "Avalie o atendimento"}</DialogTitle>
                <p className="mt-1 truncate text-xs font-bold text-slate-500">#{feedback.chamadoId} · {feedback.titulo}</p>
              </div>
            </div>
            <DialogDescription className="text-sm leading-relaxed text-slate-400">
              {etapa === "convite" ? "Sua solicitação foi concluída. Deseja deixar um feedback rápido para a equipe de TI?" : "Suas respostas ficam vinculadas a este chamado e ajudam a aprimorar o suporte interno."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 sm:p-7">
          {etapa === "convite" ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden="true" />
                <div><p className="text-sm font-bold text-emerald-100">Atendimento concluído</p><p className="mt-1 text-xs leading-relaxed text-emerald-200/60">Leva menos de um minuto. Você pode também optar por não responder.</p></div>
              </div>
              {totalNaFila > 1 && <p role="status" className="text-center text-[11px] font-medium text-slate-500">Há {totalNaFila} avaliações pendentes. Elas serão exibidas uma por vez.</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={recusar} disabled={isPending} className="h-12 border-white/10 bg-white/[0.03] font-black text-slate-300 hover:bg-white/10 hover:text-white">{isPending ? <><Loader2 className="animate-spin" aria-hidden="true" />Registrando...</> : "Não, obrigado"}</Button>
                <Button type="button" onClick={() => setEtapa("formulario")} disabled={isPending} className="h-12 font-black text-white" style={{ backgroundColor: `rgb(${accent})` }}>Sim, deixar feedback</Button>
              </div>
            </div>
          ) : (
            <ChamadoFeedbackForm chamadoId={feedback.chamadoId} accent={accent} onBack={() => setEtapa("convite")} onCompleted={onCompleted} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ChamadoFinalizadoFeedbackDialog({ accent }: ChamadoFinalizadoFeedbackDialogProps) {
  const feedbacksPendentes = useChamadoNotificacoes((state) => state.feedbacksPendentes);
  const removerFeedbackPendente = useChamadoNotificacoes((state) => state.removerFeedbackPendente);
  const feedback = feedbacksPendentes[0];
  if (!feedback) return null;

  return <FeedbackPendenteDialog key={feedback.chamadoId} feedback={feedback} totalNaFila={feedbacksPendentes.length} accent={accent} onCompleted={() => removerFeedbackPendente(feedback.chamadoId)} />;
}
