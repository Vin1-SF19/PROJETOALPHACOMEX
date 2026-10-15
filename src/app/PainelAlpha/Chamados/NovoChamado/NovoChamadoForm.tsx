"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Building2, CalendarClock, Loader2, MessageSquare, Send, ShieldAlert, Tag, UserRoundSearch, Zap } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createChamadoAction } from "@/actions/chamados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { getChamadosCatalogo } from "@/actions/chamados-categorias";
import { GerenciarCategoriasDialog } from "@/components/chamados/GerenciarCategoriasDialog";
import { criarChamadoSchema } from "@/lib/chamados/schemas";

type CatalogoChamados = Awaited<ReturnType<typeof getChamadosCatalogo>>;

interface NovoChamadoFormProps {
  catalogoInicial: CatalogoChamados;
  podeGerenciarCategorias: boolean;
}

const PRIORIDADES = [
  ["BAIXA", "Baixa", "Pode aguardar", "peer-checked:bg-emerald-600 peer-checked:border-emerald-400"],
  ["MEDIA", "Média", "Prazo normal", "peer-checked:bg-blue-600 peer-checked:border-blue-400"],
  ["ALTA", "Alta", "Atenção necessária", "peer-checked:bg-orange-600 peer-checked:border-orange-400"],
  ["URGENTE", "Urgente", "Impacto crítico", "peer-checked:bg-rose-600 peer-checked:border-rose-400"],
] as const;

type ChamadoInput = z.input<typeof criarChamadoSchema>;
type ChamadoOutput = z.output<typeof criarChamadoSchema>;

export function NovoChamadoForm({ catalogoInicial, podeGerenciarCategorias }: NovoChamadoFormProps) {
  const [catalogo, setCatalogo] = useState(catalogoInicial);
  const [isPending, startTransition] = useTransition();
  const { control, register, handleSubmit, setValue, getValues, formState: { errors } } = useForm<ChamadoInput, unknown, ChamadoOutput>({
    resolver: zodResolver(criarChamadoSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      setorDestinoId: "",
      categoriaId: "",
      prioridade: "MEDIA",
      tecnicoSolicitadoId: "",
      dataDesejadaConclusao: "",
    },
  });
  const setorDestinoId = useWatch({ control, name: "setorDestinoId" });
  const categorias = catalogo.categorias.filter((categoria) => categoria.ativo && categoria.setorId === Number(setorDestinoId));
  const responsaveis = catalogo.responsaveis.filter((pessoa) => pessoa.setorId === Number(setorDestinoId));
  const atualizarCatalogo = (atualizado: CatalogoChamados) => {
    setCatalogo(atualizado);
    const categoriaId = Number(getValues("categoriaId"));
    const destinoId = Number(getValues("setorDestinoId"));
    const responsavelId = Number(getValues("tecnicoSolicitadoId"));
    if (!atualizado.categorias.some((categoria) => categoria.id === categoriaId && categoria.ativo && categoria.setorId === destinoId)) {
      setValue("categoriaId", "");
    }
    if (!atualizado.responsaveis.some((pessoa) => pessoa.id === responsavelId && pessoa.setorId === destinoId)) {
      setValue("tecnicoSolicitadoId", "");
    }
  };
  const descricao = useWatch({ control, name: "descricao" }) ?? "";

  const onSubmit = handleSubmit((_dados, event) => {
    // O resolver do react-hook-form valida de forma assíncrona antes de chamar
    // este callback. Nesse ponto, o React já limpou `currentTarget`, enquanto
    // `target` ainda referencia o formulário que originou o submit.
    const formulario = event?.target;
    if (!(formulario instanceof HTMLFormElement)) {
      toast.error("Não foi possível ler o formulário.");
      return;
    }
    const formData = new FormData(formulario);
    startTransition(async () => {
      try {
        const resposta = await createChamadoAction(formData);
        if (resposta?.error) toast.error(resposta.error);
      } catch (error: unknown) {
        if (error instanceof Error && error.message === "NEXT_REDIRECT") return;
        toast.error("Falha ao registrar o chamado.");
      }
    });
  });

  const inputClass = "h-12 rounded-2xl border-white/5 bg-black/40 text-sm font-bold text-white placeholder:text-slate-700 focus:border-blue-500/50 focus:ring-blue-500/10";

  return (
    <main className="min-h-screen bg-[#020617] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black px-4 py-8 text-white sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/PainelAlpha/Chamados" className="group mb-8 inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-blue-400 sm:mb-10">
          <span className="rounded-lg border border-white/5 bg-white/5 p-2 transition-all group-hover:border-blue-500/50">
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest">Voltar para Chamados</span>
        </Link>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-slate-900/20 p-5 shadow-[0_0_60px_rgba(0,0,0,0.5)] ring-1 ring-white/5 backdrop-blur-3xl sm:rounded-[2.5rem] sm:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 size-64 rounded-full bg-blue-600/10 blur-[100px]" />
          <header className="relative mb-8 sm:mb-10">
            <div className="mb-1 flex items-center gap-3">
              <div className="rounded-2xl border border-blue-500/20 bg-blue-600/15 p-2.5"><Zap className="size-5 text-blue-400" aria-hidden="true" /></div>
              <h1 className="text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">Abrir <span className="text-blue-500">Chamado</span></h1>
            </div>
            <p className="ml-1 mt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 sm:tracking-[0.3em]">Informe a ocorrência; responsável e prazo são opcionais</p>
          </header>

          <form onSubmit={onSubmit} className="relative space-y-7" noValidate>
            <div className="space-y-2">
              <Label htmlFor="chamado-titulo" className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Título do chamado</Label>
              <Input id="chamado-titulo" {...register("titulo")} maxLength={120} placeholder="Ex: Falha ao acessar o sistema de estoque" aria-invalid={Boolean(errors.titulo)} aria-describedby={errors.titulo ? "erro-titulo" : undefined} className={inputClass} />
              {errors.titulo && <p id="erro-titulo" role="alert" className="text-xs text-rose-300">{errors.titulo.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="chamado-setor" className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400"><Building2 size={13} className="text-blue-400" aria-hidden="true" />Setor de destino</Label>
              <Controller control={control} name="setorDestinoId" render={({ field }) => <>
                <input type="hidden" name={field.name} value={field.value ? String(field.value) : ""} />
                <Select value={field.value ? String(field.value) : ""} onValueChange={(valor) => { field.onChange(valor); setValue("categoriaId", ""); setValue("tecnicoSolicitadoId", ""); }} disabled={isPending}>
                  <SelectTrigger id="chamado-setor" ref={field.ref} onBlur={field.onBlur} aria-invalid={Boolean(errors.setorDestinoId)} aria-describedby={errors.setorDestinoId ? "erro-setor" : undefined} className={`${inputClass} w-full`}><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>{catalogo.setores.map((setor) => <SelectItem key={setor.id} value={String(setor.id)}>{setor.nome}</SelectItem>)}</SelectContent>
                </Select>
              </>} />
              {errors.setorDestinoId && <p id="erro-setor" role="alert" className="text-xs text-rose-300">{String(errors.setorDestinoId.message)}</p>}
              {!catalogo.setores.length && <p role="status" className="text-xs text-amber-300">Nenhum setor disponível para abertura de chamados.</p>}
            </div>

            <fieldset className="space-y-3" aria-describedby={errors.categoriaId ? "erro-categoria" : undefined}>
              <legend className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400"><span className="inline-flex items-center gap-2"><Tag size={13} className="text-purple-400" aria-hidden="true" />Categoria{podeGerenciarCategorias && <GerenciarCategoriasDialog setorInicialId={Number(setorDestinoId) || undefined} onCatalogoAtualizado={atualizarCatalogo} />}</span></legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {categorias.map((categoria) => <label key={categoria.id} className="group relative cursor-pointer"><input type="radio" value={String(categoria.id)} {...register("categoriaId")} disabled={isPending} className="peer sr-only" /><span className="flex flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-all group-hover:border-white/15 peer-checked:border-purple-500/40 peer-checked:bg-purple-600/10 peer-focus-visible:ring-2 peer-focus-visible:ring-purple-400"><span className="text-sm font-black text-slate-300">{categoria.nome}</span>{categoria.descricao && <span className="mt-0.5 text-[10px] font-bold text-slate-600">{categoria.descricao}</span>}</span></label>)}
              </div>
              {!categorias.length && <p role="status" className="ml-1 text-xs text-slate-500">{setorDestinoId ? "Nenhuma categoria ativa neste setor." : "Selecione o setor para ver as categorias."}</p>}
              {errors.categoriaId && <p id="erro-categoria" role="alert" className="text-xs text-rose-300">{String(errors.categoriaId.message)}</p>}
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400"><ShieldAlert size={13} className="text-amber-400" aria-hidden="true" />Nível de urgência</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PRIORIDADES.map(([value, label, desc, activeClass]) => <label key={value} className="group relative cursor-pointer"><input type="radio" value={value} {...register("prioridade")} className="peer sr-only" /><span className={`flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/5 p-3 text-[10px] font-black uppercase text-slate-400 transition-all group-hover:border-white/20 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400 ${activeClass}`}><span className="text-sm">{label}</span><span className="mt-0.5 text-[9px] font-bold normal-case opacity-70">{desc}</span></span></label>)}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="chamado-responsavel" className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400"><UserRoundSearch size={13} className="text-blue-400" aria-hidden="true" />Responsável desejado <span className="normal-case text-slate-600">(opcional)</span></Label>
                <Controller control={control} name="tecnicoSolicitadoId" render={({ field }) => <><input type="hidden" name={field.name} value={field.value ? String(field.value) : ""} /><Select value={field.value ? String(field.value) : "nenhum"} onValueChange={(value) => field.onChange(value === "nenhum" ? "" : value)} disabled={isPending || !setorDestinoId}><SelectTrigger id="chamado-responsavel" aria-label="Responsável desejado" aria-invalid={Boolean(errors.tecnicoSolicitadoId)} className={`${inputClass} w-full`}><SelectValue placeholder="Sem preferência" /></SelectTrigger><SelectContent><SelectItem value="nenhum">Sem preferência</SelectItem>{responsaveis.map((pessoa) => <SelectItem key={pessoa.id} value={String(pessoa.id)}>{pessoa.nome}</SelectItem>)}</SelectContent></Select></>} />
                <p className="text-[10px] leading-relaxed text-slate-600">Se você escolher alguém, somente essa pessoa poderá assumir o chamado.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="chamado-data-desejada" className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400"><CalendarClock size={13} className="text-blue-400" aria-hidden="true" />Conclusão desejada <span className="normal-case text-slate-600">(opcional)</span></Label>
                <Input id="chamado-data-desejada" type="date" {...register("dataDesejadaConclusao")} aria-invalid={Boolean(errors.dataDesejadaConclusao)} className={`${inputClass} [color-scheme:dark]`} />
                <p className="text-[10px] leading-relaxed text-slate-600">É uma preferência e não altera o prazo operacional da equipe.</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="ml-1 flex items-center justify-between"><Label htmlFor="chamado-descricao" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400"><MessageSquare size={13} className="text-blue-400" aria-hidden="true" />Descrição detalhada</Label><span className={`text-[10px] font-bold tabular-nums ${descricao.length > 720 ? "text-amber-400" : "text-slate-600"}`}>{descricao.length}/800</span></div>
              <textarea id="chamado-descricao" {...register("descricao")} rows={5} maxLength={800} placeholder="Descreva o problema, quando começou e o que já foi tentado..." aria-invalid={Boolean(errors.descricao)} aria-describedby={errors.descricao ? "erro-descricao" : undefined} className="w-full resize-none rounded-[1.5rem] border border-white/5 bg-black/40 p-5 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-700 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/5 aria-invalid:border-rose-400" />
              {errors.descricao && <p id="erro-descricao" role="alert" className="text-xs text-rose-300">{errors.descricao.message}</p>}
            </div>

            <Button type="submit" disabled={isPending} aria-busy={isPending} className="h-14 w-full rounded-[1.5rem] bg-blue-600 text-sm font-black uppercase tracking-[0.15em] text-white shadow-2xl shadow-blue-900/40 transition-all hover:bg-blue-500 active:scale-[0.99] disabled:bg-slate-800 disabled:text-slate-500">{isPending ? <><Loader2 className="size-5 animate-spin" aria-hidden="true" />Registrando chamado...</> : <><Send className="size-5" aria-hidden="true" />Abrir chamado</>}</Button>
          </form>
        </section>
      </div>
    </main>
  );
}
