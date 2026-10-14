"use client";

import { useEffect, useState } from "react";
import { LerVisibilidadePipelineBpm, SalvarVisibilidadePipelineBpm } from "@/actions/bpm/VisibilidadePipeline";

type Configuracao = Extract<Awaited<ReturnType<typeof LerVisibilidadePipelineBpm>>, { success: true }>["data"];

export function VisibilidadePipelineSection({ pipelineId, publicationBlocked, onPublished }: { pipelineId: string; publicationBlocked: boolean; onPublished: () => void }) {
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void LerVisibilidadePipelineBpm(pipelineId).then((result) => {
      if (cancelled) return;
      if (!result.success) { setErro(result.error); return; }
      setConfig(result.data); setSelecionados(result.data.setorIds); setErro(null);
    }).catch(() => { if (!cancelled) setErro("Não foi possível carregar. Tente novamente."); });
    return () => { cancelled = true; };
  }, [pipelineId, revision]);
  async function salvar() {
    if (!config || salvando || publicationBlocked) return;
    setSalvando(true); setErro(null); setSucesso(false);
    try {
      const result = await SalvarVisibilidadePipelineBpm({ pipelineId, setorIds: selecionados, versao: config.versao });
      if (!result.success) { setErro(result.error); return; }
      setConfig({ ...config, setorIds: selecionados, versao: result.versao }); setSucesso(true); onPublished();
    } catch { setErro("Não foi possível salvar. Tente novamente."); }
    finally { setSalvando(false); }
  }
  return <section className="space-y-4 rounded-xl border border-white/10 p-4">
    <h2 className="text-sm font-bold text-white">Visibilidade do pipeline</h2>
    <p className="text-sm text-slate-400">Escolha quais setores podem acessar este pipeline. Sem seleção, todos os usuários com acesso ao CRM podem entrar. Administradores sempre têm acesso.</p>
    <p className="text-xs text-slate-400">Dentro do pipeline, cada pessoa vê os leads em que é responsável ou participante. Leads sem vínculo ficam disponíveis para todos com acesso. As restrições por coluna continuam valendo. Um vínculo com um card não libera um pipeline restrito a outro setor.</p>
    {erro && <div role="alert" className="text-sm text-rose-300">{erro} <button type="button" onClick={() => setRevision((n) => n + 1)} className="underline">Recarregar configuração</button></div>}
    {!config ? <p role="status" className="text-sm text-slate-400">{erro ? "Configuração indisponível." : "Carregando configuração…"}</p> : <>
      <div className="flex flex-wrap gap-3">{config.setores.map((setor) => <label key={setor.id} className="flex items-center gap-2 rounded-lg bg-white/5 p-3 text-sm text-slate-200">
        <input type="checkbox" disabled={salvando || publicationBlocked} checked={selecionados.includes(setor.id)} onChange={(event) => { setSucesso(false); setSelecionados((ids) => event.target.checked ? [...ids, setor.id] : ids.filter((id) => id !== setor.id)); }} />{setor.nome}
      </label>)}</div>
      <p className="text-xs text-cyan-300">{selecionados.length ? `${selecionados.length} setor(es) autorizado(s), além dos administradores.` : "Disponível para todos com acesso ao CRM."}</p>
      <button type="button" disabled={salvando || publicationBlocked} onClick={() => void salvar()} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50">{salvando ? "Publicando…" : "Publicar visibilidade do pipeline"}</button>
    </>}
    {publicationBlocked && <p className="text-xs text-amber-200">Publique ou descarte o rascunho principal antes de publicar permissões.</p>}
    {sucesso && <p role="status" className="text-sm text-emerald-300">Visibilidade do pipeline publicada.</p>}
  </section>;
}
