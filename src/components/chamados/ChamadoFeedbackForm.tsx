"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Loader2, MessageSquareWarning } from "lucide-react";
import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { responderFeedbackChamadoAction } from "@/actions/chamados-feedback";
import { Button } from "@/components/ui/button";
import { responderFeedbackChamadoSchema } from "@/lib/chamados/schemas";
import { FeedbackRatingScale } from "./FeedbackRatingScale";

interface ChamadoFeedbackFormProps {
  chamadoId: number;
  accent: string;
  onBack: () => void;
  onCompleted: () => void;
}

type FeedbackInput = z.input<typeof responderFeedbackChamadoSchema>;
type FeedbackOutput = z.output<typeof responderFeedbackChamadoSchema>;

export function ChamadoFeedbackForm({ chamadoId, accent, onBack, onCompleted }: ChamadoFeedbackFormProps) {
  const [isPending, startTransition] = useTransition();
  const { control, register, handleSubmit, formState: { errors } } = useForm<FeedbackInput, unknown, FeedbackOutput>({
    resolver: zodResolver(responderFeedbackChamadoSchema),
    defaultValues: { chamadoId },
    shouldUnregister: true,
  });
  const solucionadaComoEsperado = useWatch({ control, name: "solucionadaComoEsperado" });

  const submit = handleSubmit((payload) => {
    startTransition(async () => {
      const resposta = await responderFeedbackChamadoAction(payload);
      if (!resposta.success) {
        toast.error(resposta.error ?? "Não foi possível salvar o feedback.");
        return;
      }
      toast.success("Obrigado! Seu feedback foi registrado.");
      onCompleted();
    });
  });

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <input type="hidden" {...register("chamadoId", { valueAsNumber: true })} />
      <Controller control={control} name="notaRapidezResposta" render={({ field }) => (
        <FeedbackRatingScale id="nota-rapidez-resposta" label="O tempo de resposta foi rápido?" lowLabel="extremamente demorado" highLabel="extremamente rápido" value={typeof field.value === "number" ? field.value : undefined} onChange={field.onChange} error={errors.notaRapidezResposta?.message} accent={accent} />
      )} />

      <Controller control={control} name="notaPrazoConclusao" render={({ field }) => (
        <FeedbackRatingScale id="nota-prazo-conclusao" label="Sua demanda foi finalizada no tempo esperado?" lowLabel="resolvido depois do esperado" highLabel="resolvido mais rápido que esperado" value={typeof field.value === "number" ? field.value : undefined} onChange={field.onChange} error={errors.notaPrazoConclusao?.message} accent={accent} />
      )} />

      <Controller control={control} name="solucionadaComoEsperado" render={({ field }) => (
        <fieldset className="space-y-3">
          <legend className="text-sm font-bold text-slate-100">Sua demanda foi solucionada da forma esperada?</legend>
          <div className="grid grid-cols-2 gap-2">
            {([true, false] as const).map((opcao) => {
              const checked = field.value === opcao;
              return <Button key={String(opcao)} type="button" variant="outline" aria-pressed={checked} onClick={() => field.onChange(opcao)} className="h-11 border-white/10 bg-slate-950/70 font-black text-slate-300 hover:bg-white/10 hover:text-white" style={checked ? { borderColor: `rgba(${accent}, 0.85)`, backgroundColor: `rgba(${accent}, 0.2)`, color: "white" } : undefined}>{opcao ? "SIM" : "NÃO"}</Button>;
            })}
          </div>
          {errors.solucionadaComoEsperado && <p role="alert" className="text-xs text-rose-300">Escolha SIM ou NÃO.</p>}
        </fieldset>
      )} />

      {solucionadaComoEsperado === false && (
        <div className="space-y-2">
          <label htmlFor="feedback-comentario" className="flex items-center gap-2 text-sm font-bold text-slate-100"><MessageSquareWarning size={16} className="text-amber-300" aria-hidden="true" />Conte o que poderia ter sido diferente</label>
          <textarea id="feedback-comentario" {...register("comentario")} rows={4} minLength={10} maxLength={1000} aria-invalid={Boolean(errors.comentario)} aria-describedby="feedback-comentario-ajuda" className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-blue-400 aria-invalid:border-rose-400" placeholder="Escreva pelo menos 10 caracteres..." />
          <p id="feedback-comentario-ajuda" className={errors.comentario ? "text-xs text-rose-300" : "text-xs text-slate-500"}>{errors.comentario?.message ?? "Seu relato ajuda a equipe a melhorar os próximos atendimentos."}</p>
        </div>
      )}

      {solucionadaComoEsperado === true && (
        <Controller control={control} name="notaQualidadeSolucao" render={({ field }) => (
          <FeedbackRatingScale id="nota-qualidade-solucao" label="Sua demanda foi solucionada da melhor forma?" lowLabel="resolvida de forma mediana" highLabel="resolvida da melhor forma possível" value={typeof field.value === "number" ? field.value : undefined} onChange={field.onChange} error={errors.notaQualidadeSolucao?.message} accent={accent} />
        )} />
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-white/5 pt-5 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isPending} className="text-slate-400 hover:bg-white/5 hover:text-white"><ArrowLeft aria-hidden="true" />Voltar</Button>
        <Button type="submit" disabled={isPending} aria-busy={isPending} className="text-white" style={{ backgroundColor: `rgb(${accent})` }}>{isPending ? <><Loader2 className="animate-spin" aria-hidden="true" />Salvando...</> : <><Check aria-hidden="true" />Enviar feedback</>}</Button>
      </div>
    </form>
  );
}
