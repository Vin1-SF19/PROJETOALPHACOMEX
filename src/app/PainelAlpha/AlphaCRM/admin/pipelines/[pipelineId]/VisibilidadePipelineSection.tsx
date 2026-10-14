"use client";

import type { ConfiguracaoVisaoEquipe } from "@/lib/bpm/visao-equipe";
import { useEffect, useState } from "react";
import { LerVisibilidadePipelineBpm, SalvarVisibilidadePipelineBpm } from "@/actions/bpm/VisibilidadePipeline";

type Configuracao = Extract<Awaited<ReturnType<typeof LerVisibilidadePipelineBpm>>, { success: true }>["data"];

export function VisibilidadePipelineSection({ pipelineId, publicationBlocked, onPublished }: { pipelineId: string; publicationBlocked: boolean; onPublished: () => void }) {
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [visualizacao, setVisualizacao] = useState<ConfiguracaoVisaoEquipe>({ version: 1, supervisores: [] });
  const [novoSupervisor, setNovoSupervisor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void LerVisibilidadePipelineBpm(pipelineId).then((result) => {
      if (cancelled) return;
      if (!result.success) { setErro(result.error); return; }
      setConfig(result.data); setVisualizacao(result.data.visualizacao); setSelecionados(result.data.setorIds); setErro(null);
    }).catch(() => { if (!cancelled) setErro("Não foi possível carregar. Tente novamente."); });
    return () => { cancelled = true; };
  }, [pipelineId, revision]);
  async function salvar() {
    if (!config || salvando || publicationBlocked) return;
    setSalvando(true); setErro(null); setSucesso(false);
    try {
      const result = await SalvarVisibilidadePipelineBpm({ pipelineId, setorIds: selecionados, versao: config.versao, visualizacao });
      if (!result.success) { setErro(result.error); return; }
      setConfig({ ...config, visualizacao, setorIds: selecionados, versao: result.versao }); setSucesso(true); onPublished();
    } catch { setErro("Não foi possível salvar. Tente novamente."); }
    finally { setSalvando(false); }
  }
  return <section className="space-y-4 rounded-xl border border-white/10 p-4">
    <h2 className="text-sm font-bold text-white">Visibilidade do pipeline</h2>
    <p className="text-sm text-slate-400">Escolha quais setores podem acessar este pipeline. Sem seleção, todos os usuários com acesso ao CRM podem entrar. Administradores sempre têm acesso.</p>
    <p className="text-xs text-slate-400">Ao abrir, cada pessoa vê seus leads e os sem vínculo. Supervisores configurados abaixo podem consultar equipes; administradores podem consultar todos. Leads sem vínculo ficam disponíveis para todos com acesso. As restrições por coluna continuam valendo. Um vínculo com um card não libera um pipeline restrito a outro setor.</p>
    {erro && <div role="alert" className="text-sm text-rose-300">{erro} <button type="button" onClick={() => setRevision((n) => n + 1)} className="underline">Recarregar configuração</button></div>}
    {!config ? <p role="status" className="text-sm text-slate-400">{erro ? "Configuração indisponível." : "Carregando configuração…"}</p> : <>
      <div className="flex flex-wrap gap-3">{config.setores.map((setor) => <label key={setor.id} className="flex items-center gap-2 rounded-lg bg-white/5 p-3 text-sm text-slate-200">
        <input type="checkbox" disabled={salvando || publicationBlocked} checked={selecionados.includes(setor.id)} onChange={(event) => { setSucesso(false); setSelecionados((ids) => event.target.checked ? [...ids, setor.id] : ids.filter((id) => id !== setor.id)); }} />{setor.nome}
      </label>)}</div>
      <p className="text-xs text-cyan-300">{selecionados.length ? `${selecionados.length} setor(es) autorizado(s), além dos administradores.` : "Disponível para todos com acesso ao CRM."}</p>
      <div className="space-y-3 border-t border-white/10 pt-4">
        <h3 className="text-sm font-bold text-white">Visão de equipe</h3>
        <p className="text-xs text-slate-400">Escolha os líderes que poderão consultar leads de outros usuários e os setores permitidos para cada um neste pipeline. O setor considera responsáveis e participantes. Essa permissão é somente de leitura; para editar um card, a pessoa precisa ter o vínculo e as permissões correspondentes.</p>
        <p className="text-xs text-slate-400">O supervisor também precisa ter acesso ao pipeline e à coluna. Todos começam em “Meus leads e sem vínculo” e podem mudar a visualização pelo filtro.</p>
        {visualizacao.supervisores.map((supervisor) => <fieldset key={supervisor.usuarioId} disabled={salvando || publicationBlocked} className="space-y-2 rounded-lg border border-white/10 p-3">
          <legend className="px-1 text-sm text-slate-200">{config.usuarios.find((u) => u.id === supervisor.usuarioId)?.nome ?? "Usuário indisponível"}</legend>
          <div className="flex flex-wrap gap-3">{config.setores.map((setor) => <label key={setor.id} className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={supervisor.setorIds.includes(setor.id)} onChange={(event) => { setSucesso(false); setVisualizacao((v) => ({ ...v, supervisores: v.supervisores.map((s) => s.usuarioId !== supervisor.usuarioId ? s : { ...s, setorIds: event.target.checked ? [...s.setorIds, setor.id] : s.setorIds.filter((id) => id !== setor.id) }) })); }} />{setor.nome}
          </label>)}</div>
          <button type="button" className="text-xs text-rose-300 underline" onClick={() => { setSucesso(false); setVisualizacao((v) => ({ ...v, supervisores: v.supervisores.filter((s) => s.usuarioId !== supervisor.usuarioId) })); }}>Remover supervisor</button>
        </fieldset>)}
        <div className="flex flex-wrap gap-2">
          <select aria-label="Adicionar supervisor" value={novoSupervisor} disabled={salvando || publicationBlocked} onChange={(e) => setNovoSupervisor(e.target.value)} className="rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-slate-200">
            <option value="">Selecione uma pessoa</option>{config.usuarios.filter((u) => !visualizacao.supervisores.some((s) => s.usuarioId === u.id)).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <button type="button" disabled={!novoSupervisor || salvando || publicationBlocked} className="rounded-lg bg-white/5 px-3 py-2 text-xs text-cyan-200 disabled:opacity-50" onClick={() => { setVisualizacao((v) => ({ ...v, supervisores: [...v.supervisores, { usuarioId: Number(novoSupervisor), setorIds: [] }] })); setNovoSupervisor(""); setSucesso(false); }}>Adicionar supervisor</button>
        </div>
      </div>
      <button type="button" disabled={salvando || publicationBlocked} onClick={() => void salvar()} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50">{salvando ? "Publicando…" : "Publicar visibilidade do pipeline"}</button>
    </>}
    {publicationBlocked && <p className="text-xs text-amber-200">Publique ou descarte o rascunho principal antes de publicar permissões.</p>}
    {sucesso && <p role="status" className="text-sm text-emerald-300">Visibilidade do pipeline publicada.</p>}
  </section>;
}
