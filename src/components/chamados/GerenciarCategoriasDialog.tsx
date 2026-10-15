"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { chamadoCategoriaSchema } from "@/lib/chamados/schemas";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Archive, Check, Loader2, Pencil, Plus, RotateCcw, Settings, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { excluirCategoriaChamado, getChamadosCatalogo, salvarCategoriaChamado } from "@/actions/chamados-categorias";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CatalogoChamados = Awaited<ReturnType<typeof getChamadosCatalogo>>;
type Categoria = CatalogoChamados["categorias"][number];

interface GerenciarCategoriasDialogProps {
  setorInicialId?: number;
  onCatalogoAtualizado: (catalogo: CatalogoChamados) => void;
}

export function GerenciarCategoriasDialog(props: GerenciarCategoriasDialogProps) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><CategoriasDialog {...props} /></QueryClientProvider>;
}

function CategoriasDialog({ setorInicialId, onCatalogoAtualizado }: GerenciarCategoriasDialogProps) {
  const [open, setOpen] = useState(false);
  const [setorId, setSetorId] = useState("");
  const [edicao, setEdicao] = useState<Categoria | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.input<typeof chamadoCategoriaSchema>>({ resolver: zodResolver(chamadoCategoriaSchema), defaultValues: { nome: "", descricao: "" } });
  const [erro, setErro] = useState("");
  const [isPending, startTransition] = useTransition();
  const catalogo = useQuery({ queryKey: ["chamados-catalogo", "gestao"], queryFn: () => getChamadosCatalogo(true), enabled: open });
  const categorias = catalogo.data?.categorias.filter((categoria) => categoria.setorId === Number(setorId)) ?? [];
  const inputClass = "h-12 rounded-2xl border-white/5 bg-black/40 text-sm font-bold text-white";

  const limparEdicao = () => { setEdicao(null); reset({ setorId: Number(setorId) || undefined, nome: "", descricao: "" }); setErro(""); };
  const atualizar = async () => {
    const resposta = await catalogo.refetch();
    if (resposta.data) onCatalogoAtualizado(resposta.data);
  };
  const executar = (acao: () => Promise<{ success: boolean; error?: string; arquivada?: boolean }>, mensagem: string) => {
    setErro("");
    startTransition(async () => {
      try {
        const resultado = await acao();
        if (!resultado.success) { setErro(resultado.error ?? "Não foi possível salvar a categoria."); return; }
        await atualizar();
        limparEdicao();
        toast.success(resultado.arquivada ? "Categoria arquivada para preservar o histórico." : mensagem);
      } catch { setErro("Não foi possível atualizar as categorias. Tente novamente."); }
    });
  };

  return <Dialog open={open} onOpenChange={(valor) => { setOpen(valor); if (valor) { setSetorId(setorInicialId ? String(setorInicialId) : ""); setEdicao(null); reset({ setorId: setorInicialId, nome: "", descricao: "" }); setErro(""); } }}>
    <DialogTrigger asChild><button type="button" aria-label="Gerenciar categorias" title="Gerenciar categorias" className="cursor-pointer rounded-lg p-1.5 text-purple-400 transition-colors hover:bg-purple-500/10 hover:text-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"><Settings className="size-4" aria-hidden="true" /></button></DialogTrigger>
    <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden rounded-[2rem] border-blue-500/10 bg-[#080e1a] p-0 text-white sm:max-w-2xl">
      <DialogHeader className="shrink-0 border-b border-white/5 bg-gradient-to-b from-blue-600/5 to-transparent p-6 pr-12">
        <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase italic tracking-tighter"><Settings className="size-5 text-purple-400" aria-hidden="true" />Gerenciar categorias</DialogTitle>
        <DialogDescription className="text-xs text-slate-500">Categorias de chamados por setor. O histórico dos atendimentos é preservado.</DialogDescription>
      </DialogHeader>
      <div className="space-y-5 overflow-y-auto p-6 custom-scrollbar">
        {catalogo.isLoading && <p role="status" className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Carregando categorias...</p>}
        {catalogo.isError && <div role="alert" className="space-y-2 text-xs text-rose-300"><p>Não foi possível carregar as categorias.</p><Button variant="ghost" onClick={() => catalogo.refetch()}>Tentar novamente</Button></div>}
        {catalogo.data && <>
          <div className="space-y-2">
            <Label htmlFor="gestao-categoria-setor" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Setor</Label>
            <Select value={setorId} onValueChange={(valor) => { setSetorId(valor); setEdicao(null); reset({ setorId: Number(valor), nome: "", descricao: "" }); setErro(""); }} disabled={isPending}>
              <SelectTrigger id="gestao-categoria-setor" className={`${inputClass} w-full`}><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
              <SelectContent>{catalogo.data.setores.map((setor) => <SelectItem key={setor.id} value={String(setor.id)}>{setor.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {setorId && <>
            <div className="space-y-2" aria-label="Categorias do setor">
              {!categorias.length && <p role="status" className="text-xs text-slate-500">Nenhuma categoria cadastrada neste setor.</p>}
              {categorias.map((categoria) => <div key={categoria.id} className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                <div className="min-w-0 flex-1"><p className="break-words text-sm font-bold text-slate-300">{categoria.nome}{!categoria.ativo && <span className="ml-2 text-[10px] text-slate-500">Arquivada</span>}</p>{categoria.descricao && <p className="mt-1 break-words text-xs text-slate-500">{categoria.descricao}</p>}</div>
                <Button type="button" size="icon" variant="ghost" disabled={isPending} aria-label={`Editar ${categoria.nome}`} title="Editar" onClick={() => { setEdicao(categoria); reset({ id: categoria.id, setorId: categoria.setorId, nome: categoria.nome, descricao: categoria.descricao ?? "" }); setErro(""); }} className="shrink-0 text-blue-400"><Pencil className="size-4" aria-hidden="true" /></Button>
                <Button type="button" size="icon" variant="ghost" disabled={isPending} aria-label={`${categoria.ativo ? "Arquivar" : "Reativar"} ${categoria.nome}`} title={categoria.ativo ? "Arquivar" : "Reativar"} onClick={() => executar(() => salvarCategoriaChamado({ ...categoria, descricao: categoria.descricao ?? undefined, ativo: !categoria.ativo }), categoria.ativo ? "Categoria arquivada." : "Categoria reativada.")} className="shrink-0 text-amber-400">{categoria.ativo ? <Archive className="size-4" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}</Button>
                <Button type="button" size="icon" variant="ghost" disabled={isPending} aria-label={`Excluir ${categoria.nome}`} title="Excluir sem uso ou arquivar com histórico" onClick={() => executar(() => excluirCategoriaChamado(categoria.id), "Categoria excluída.")} className="shrink-0 text-rose-400"><Trash2 className="size-4" aria-hidden="true" /></Button>
              </div>)}
            </div>
            <form onSubmit={(event) => { event.stopPropagation(); void handleSubmit((dados) => executar(() => salvarCategoriaChamado(dados), edicao ? "Categoria atualizada." : "Categoria adicionada."))(event); }} className="space-y-3 rounded-2xl border border-purple-500/10 bg-purple-500/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">{edicao ? "Editar categoria" : "Adicionar categoria"}</p>
              <div className="space-y-2"><Label htmlFor="categoria-nome" className="text-xs text-slate-400">Nome</Label><Input id="categoria-nome" {...register("nome")} aria-invalid={Boolean(errors.nome)} disabled={isPending} required maxLength={80} className={inputClass} /></div>
              <div className="space-y-2"><Label htmlFor="categoria-descricao" className="text-xs text-slate-400">Descrição (opcional)</Label><Input id="categoria-descricao" {...register("descricao")} aria-invalid={Boolean(errors.descricao)} disabled={isPending} maxLength={240} className={inputClass} /></div>
              {errors.nome && <p role="alert" className="text-xs text-rose-300">{errors.nome.message}</p>}{errors.descricao && <p role="alert" className="text-xs text-rose-300">{errors.descricao.message}</p>}<div className="flex flex-wrap justify-end gap-2">{edicao && <Button type="button" variant="ghost" onClick={limparEdicao} disabled={isPending}><X className="size-4" aria-hidden="true" />Cancelar edição</Button>}<Button type="submit" disabled={isPending} className="rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-500">{isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : edicao ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}{edicao ? "Salvar" : "Adicionar"}</Button></div>
            </form>
          </>}
        </>}
        {erro && <p role="alert" className="text-xs text-rose-300">{erro}</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
