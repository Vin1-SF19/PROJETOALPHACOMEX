"use client";

import { useId, useState } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck, Trash2, Users } from "lucide-react";
import { LerAcessosPipelineBpm, SalvarAcessosPipelineBpm } from "@/actions/bpm/AcessosPipeline";
import type { RegraAcessoPipeline } from "@/lib/bpm/acesso-pipeline";

interface FunilAcesso { id: string; nome: string }
interface AcessosPipelineSectionProps {
  pipelineId?: string;
  pipelineNome?: string;
  pipelines?: FunilAcesso[];
  publicationBlocked?: boolean;
  onPublished: () => void;
}
const formularioSchema = z.object({
  tipo: z.enum(["SETOR", "USUARIO"]),
  id: z.string().regex(/^[1-9]\d*$/, "Selecione um setor ou usuário."),
  administrativo: z.boolean(),
});
type Formulario = z.infer<typeof formularioSchema>;
type Configuracao = Extract<Awaited<ReturnType<typeof LerAcessosPipelineBpm>>, { success: true }>["data"];
const inputClass = "min-h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400/60 disabled:opacity-50";

export function AcessosPipelineSection(props: AcessosPipelineSectionProps) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  return <QueryClientProvider client={queryClient}><AcessosPipelineEditor {...props} /></QueryClientProvider>;
}

function AcessosPipelineEditor({ pipelineId: fixo, pipelineNome, pipelines = [], publicationBlocked = false, onPublished }: AcessosPipelineSectionProps) {
  const prefixo = useId();
  const [selecionado, setSelecionado] = useState(pipelines[0]?.id ?? "");
  const pipelineId = fixo ?? (pipelines.some((p) => p.id === selecionado) ? selecionado : pipelines[0]?.id ?? "");
  const nomeFunil = pipelineNome ?? pipelines.find((p) => p.id === pipelineId)?.nome ?? "este funil";
  const [sucesso, setSucesso] = useState<string | null>(null);
  const client = useQueryClient();
  const form = useForm<Formulario>({ resolver: zodResolver(formularioSchema), defaultValues: { tipo: "SETOR", id: "", administrativo: false } });
  const tipo = useWatch({ control: form.control, name: "tipo" });
  const destinatario = useWatch({ control: form.control, name: "id" });
  const queryKey = ["crm-acessos-pipeline", pipelineId];
  const consulta = useQuery({
    queryKey,
    enabled: Boolean(pipelineId),
    queryFn: async () => {
      const resposta = await LerAcessosPipelineBpm(pipelineId);
      if (!resposta.success) throw new Error(resposta.error);
      return resposta.data;
    },
  });
  const publicacao = useMutation({
    mutationFn: async (regras: RegraAcessoPipeline[]) => {
      if (!consulta.data || publicationBlocked) throw new Error("Aguarde a configuração do funil.");
      const resposta = await SalvarAcessosPipelineBpm({ pipelineId, versao: consulta.data.versao, regras });
      if (!resposta.success) throw new Error(resposta.error);
      return { regras, versao: resposta.versao };
    },
    onSuccess: ({ regras, versao }) => {
      client.setQueryData<Configuracao>(queryKey, (anterior) => anterior ? { ...anterior, regras, versao, acessoAnteriorAberto: false } : anterior);
      setSucesso(`Acessos de ${nomeFunil} salvos.`);
      onPublished();
    },
  });
  const bloqueado = publicationBlocked || publicacao.isPending || consulta.isFetching;
  const regras = consulta.data?.regras ?? [];
  const catalogo = tipo === "SETOR" ? consulta.data?.setores : consulta.data?.usuarios;
  const erro = consulta.error ?? publicacao.error;

  function publicar(novas: RegraAcessoPipeline[]) {
    setSucesso(null);
    publicacao.mutate(novas);
  }
  const liberar = form.handleSubmit((valores) => {
    const regra: RegraAcessoPipeline = { tipo: valores.tipo, id: Number(valores.id), nivel: valores.administrativo ? "ADMINISTRATIVO" : "PADRAO" };
    publicar([...regras.filter((r) => r.tipo !== regra.tipo || r.id !== regra.id), regra]);
  });
  function trocarFunil(id: string) {
    setSelecionado(id);
    setSucesso(null);
    publicacao.reset();
  }

  return <section className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/35 p-4 sm:p-6" aria-label="Acessos aos funis">
    <div>
      <h2 className="flex items-center gap-2 font-bold text-white"><ShieldCheck size={18} /> Acesso aos funis</h2>
      <p className="mt-1 text-sm text-slate-400">Escolha um setor ou usuário, selecione o funil e libere o acesso.</p>
    </div>
    {!pipelineId && <p role="status" className="text-sm text-slate-400">Crie um funil para configurar os acessos.</p>}
    {pipelineId && <form onSubmit={liberar} className="space-y-4">
      <fieldset disabled={publicationBlocked || publicacao.isPending} className="grid gap-4 sm:grid-cols-3">
        <label htmlFor={`${prefixo}-tipo`} className="space-y-2 text-xs font-semibold text-slate-300">
          <span>Liberar para</span>
          <select id={`${prefixo}-tipo`} disabled={consulta.isFetching || !consulta.data} className={inputClass} {...form.register("tipo", { onChange: () => form.setValue("id", "") })}>
            <option value="SETOR">Setor</option><option value="USUARIO">Usuário</option>
          </select>
        </label>
        <label htmlFor={`${prefixo}-destinatario`} className="space-y-2 text-xs font-semibold text-slate-300">
          <span>{tipo === "SETOR" ? "Setor" : "Usuário"}</span>
          <select id={`${prefixo}-destinatario`} disabled={consulta.isFetching || !consulta.data} className={inputClass} aria-invalid={Boolean(form.formState.errors.id)} value={destinatario} {...form.register("id")}>
            <option value="">{tipo === "SETOR" ? "Selecione o setor" : "Selecione o usuário"}</option>
            {catalogo?.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
          {form.formState.errors.id && <span role="alert" className="text-rose-300">{form.formState.errors.id.message}</span>}
        </label>
        <label htmlFor={`${prefixo}-funil`} className="space-y-2 text-xs font-semibold text-slate-300">
          <span>Funil</span>
          {fixo ? <input id={`${prefixo}-funil`} className={inputClass} readOnly value={nomeFunil} /> : <select id={`${prefixo}-funil`} className={inputClass} value={pipelineId} onChange={(event) => trocarFunil(event.target.value)}>
            {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.nome}</option>)}
          </select>}
        </label>
      </fieldset>
      <fieldset disabled={bloqueado || !consulta.data} className="space-y-3">
        <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <input type="checkbox" {...form.register("administrativo")} className="mt-1" />
          <span><span className="block text-sm font-semibold text-white">Acesso administrativo ao funil</span><span className="mt-1 block text-xs leading-relaxed text-slate-400">Permite editar, atribuir e mover livremente os cards deste funil, mesmo sem ser responsável. Não concede administração global do sistema.</span></span>
        </label>
        <p className="text-xs text-slate-400">Acesso comum mantém os vínculos dos cards e as permissões de coluna. Se houver mais de uma liberação, vale o maior nível de acesso.</p>
        <button type="submit" className="min-h-10 rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-50">{publicacao.isPending ? "Salvando…" : "Liberar acesso"}</button>
      </fieldset>
    </form>}
    {consulta.isPending && pipelineId && <p role="status" className="text-sm text-slate-400">Carregando acessos…</p>}
    {erro && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-rose-300">
      <span>{erro.message}</span><button type="button" disabled={publicacao.isPending} className="underline" onClick={() => { publicacao.reset(); setSucesso(null); void consulta.refetch(); }}>Recarregar acessos</button>
    </div>}
    {consulta.data && <div className="space-y-3 border-t border-white/10 pt-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Users size={16} /> Acessos liberados · {nomeFunil}</h3>
      {consulta.data.acessoAnteriorAberto && <p role="status" className="rounded-xl bg-amber-400/10 p-3 text-xs text-amber-200">Este funil ainda está aberto a todos com acesso ao CRM. Salve as liberações abaixo para restringir o acesso.</p>}
      <p className="text-xs text-slate-400">Ao salvar, somente os setores e usuários da lista terão acesso. Administradores do sistema sempre têm acesso.</p>
      {regras.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">Nenhum setor ou usuário na lista de acessos.</p>}
      {regras.length === 0 && <button type="button" disabled={bloqueado} onClick={() => publicar([])} className="min-h-10 rounded-xl border border-white/10 px-4 text-sm text-slate-200 disabled:opacity-50">Restringir a administradores</button>}
      <ul className="space-y-2">{regras.map((regra) => {
        const itens = regra.tipo === "SETOR" ? consulta.data.setores : consulta.data.usuarios;
        const nome = itens.find((item) => item.id === regra.id)?.nome ?? `${regra.tipo === "SETOR" ? "Setor" : "Usuário"} indisponível (${regra.id})`;
        return <li key={`${regra.tipo}-${regra.id}`} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-slate-200">{nome}</p><p className="mt-0.5 text-xs text-slate-400">{regra.tipo === "SETOR" ? "Setor" : "Usuário"} · {nomeFunil}</p></div>
          <div className="flex items-center gap-3">
            <select aria-label={`Nível de acesso de ${nome}`} disabled={bloqueado} value={regra.nivel} className={inputClass} onChange={(event) => {
              const nivel = event.target.value === "ADMINISTRATIVO" ? "ADMINISTRATIVO" : "PADRAO";
              publicar(regras.map((r) => r.tipo === regra.tipo && r.id === regra.id ? { ...r, nivel } : r));
            }}><option value="PADRAO">Acesso comum</option><option value="ADMINISTRATIVO">Administrativo</option></select>
            <button type="button" aria-label={`Remover acesso de ${nome}`} disabled={bloqueado} onClick={() => publicar(regras.filter((r) => r.tipo !== regra.tipo || r.id !== regra.id))} className="min-h-10 rounded-lg px-3 text-rose-300 hover:bg-rose-400/10 disabled:opacity-50"><Trash2 size={16} /></button>
          </div>
        </li>;
      })}</ul>
    </div>}
    {publicationBlocked && <p role="status" className="text-xs text-amber-200">Publique ou descarte o rascunho principal antes de alterar acessos.</p>}
    {sucesso && <p role="status" className="text-sm text-emerald-300">{sucesso}</p>}
  </section>;
}
