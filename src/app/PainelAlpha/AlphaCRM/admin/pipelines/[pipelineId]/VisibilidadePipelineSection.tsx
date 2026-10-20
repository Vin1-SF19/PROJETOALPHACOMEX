"use client";

import { useEffect, useState } from "react";
import { LerVisibilidadePipelineBpm, SalvarVisibilidadePipelineBpm } from "@/actions/bpm/VisibilidadePipeline";

type Configuracao = Extract<Awaited<ReturnType<typeof LerVisibilidadePipelineBpm>>, { success: true }>["data"];

export function VisibilidadePipelineSection({ pipelineId, publicationBlocked, onPublished }: { pipelineId: string; publicationBlocked: boolean; onPublished: () => void }) {
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [usuariosAutorizados, setUsuariosAutorizados] = useState<number[]>([]);
  const [novoUsuario, setNovoUsuario] = useState("");
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void LerVisibilidadePipelineBpm(pipelineId).then((result) => {
      if (cancelled) return;
      if (!result.success) { setErro(result.error); return; }
      setConfig(result.data); setUsuariosAutorizados(result.data.usuariosAutorizados ?? []); setNovoUsuario(""); setBuscaUsuario(""); setSelecionados(result.data.setorIds); setErro(null);
    }).catch(() => { if (!cancelled) setErro("Não foi possível carregar. Tente novamente."); });
    return () => { cancelled = true; };
  }, [pipelineId, revision]);
  async function salvar() {
    if (!config || salvando || publicationBlocked) return;
    setSalvando(true); setErro(null); setSucesso(false);
    try {
      const result = await SalvarVisibilidadePipelineBpm({ pipelineId, setorIds: selecionados, usuariosAutorizados, versao: config.versao });
      if (!result.success) { setErro(result.error); return; }
      setConfig({ ...config, usuariosAutorizados, setorIds: selecionados, versao: result.versao }); setSucesso(true); onPublished();
    } catch { setErro("Não foi possível salvar. Tente novamente."); }
    finally { setSalvando(false); }
  }
  return <section className="space-y-4 rounded-xl border border-white/10 p-4">
    <h2 className="text-sm font-bold text-white">Visibilidade do pipeline</h2>
    <p className="text-sm text-slate-400">Escolha quais setores podem acessar este pipeline e autorize pessoas específicas de outros setores. Sem seleção, todos os usuários com acesso ao CRM podem entrar. Administradores sempre têm acesso.</p>
    <p className="text-xs text-slate-400">Ao abrir, todos começam em “Meus e sem vínculos”. Quem tem acesso ao pipeline pode consultar os cards dos colegas pelo filtro de pessoas ou por “Todos”. As opções incluem as pessoas dos setores permitidos e as pessoas autorizadas individualmente, inclusive para TI. A consulta de cards de colegas é somente leitura; responsabilidade, participação e permissões continuam determinando as ações. As restrições por coluna continuam valendo. Um vínculo com um card não libera a entrada: pessoas de outros setores precisam da autorização individual abaixo.</p>
    {erro && <div role="alert" className="text-sm text-rose-300">{erro} <button type="button" onClick={() => setRevision((n) => n + 1)} className="underline">Recarregar configuração</button></div>}
    {!config ? <p role="status" className="text-sm text-slate-400">{erro ? "Configuração indisponível." : "Carregando configuração…"}</p> : <>
      <div className="flex flex-wrap gap-3">{config.setores.map((setor) => <label key={setor.id} className="flex items-center gap-2 rounded-lg bg-white/5 p-3 text-sm text-slate-200">
        <input type="checkbox" disabled={salvando || publicationBlocked} checked={selecionados.includes(setor.id)} onChange={(event) => { setSucesso(false); setSelecionados((ids) => event.target.checked ? [...ids, setor.id] : ids.filter((id) => id !== setor.id)); }} />{setor.nome}
      </label>)}</div>
      <p className="text-xs text-cyan-300">{selecionados.length ? `${selecionados.length} setor(es) autorizado(s), além dos administradores.` : "Disponível para todos com acesso ao CRM."}</p>
      <fieldset disabled={salvando || publicationBlocked} className="space-y-3 border-t border-white/10 pt-4">
        <legend className="text-sm font-bold text-white">Usuários autorizados individualmente</legend>
        <p className="text-xs text-slate-400">Estas pessoas podem entrar mesmo que seu setor não esteja selecionado. Elas precisam estar ativas e ter acesso ao CRM. As permissões de coluna e de ação nos cards continuam valendo. Sem setores selecionados, o pipeline já está aberto para todos com acesso ao CRM.</p>
        <div className="flex flex-wrap gap-2">
          {usuariosAutorizados.map((id) => <div key={id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200">
            <span>{config.usuarios.find((u) => u.id === id)?.nome ?? `Usuário indisponível (${id})`}</span>
            <button type="button" aria-label={`Remover autorização de ${config.usuarios.find((u) => u.id === id)?.nome ?? id}`} className="text-xs text-rose-300 underline" onClick={() => { setUsuariosAutorizados((ids) => ids.filter((value) => value !== id)); setSucesso(false); }}>Remover</button>
          </div>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Buscar usuário" type="search" placeholder="Buscar usuário" value={buscaUsuario} onChange={(event) => { setBuscaUsuario(event.target.value); setNovoUsuario(""); }} className="rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-slate-200" />
          <select aria-label="Usuário para autorizar" value={novoUsuario} onChange={(event) => setNovoUsuario(event.target.value)} className="rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-slate-200">
            <option value="">Selecione uma pessoa</option>
            {config.usuarios.filter((u) => !usuariosAutorizados.includes(u.id) && u.nome.toLocaleLowerCase("pt-BR").includes(buscaUsuario.trim().toLocaleLowerCase("pt-BR"))).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <button type="button" disabled={!novoUsuario} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-cyan-200 disabled:opacity-50" onClick={() => { setUsuariosAutorizados((ids) => [...new Set([...ids, Number(novoUsuario)])]); setNovoUsuario(""); setSucesso(false); }}>Autorizar usuário</button>
        </div>
        <p className="text-xs text-slate-400">Publique a visibilidade para salvar as autorizações e remoções.</p>
      </fieldset>
      <button type="button" disabled={salvando || publicationBlocked} onClick={() => void salvar()} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50">{salvando ? "Publicando…" : "Publicar visibilidade do pipeline"}</button>
    </>}
    {publicationBlocked && <p className="text-xs text-amber-200">Publique ou descarte o rascunho principal antes de publicar permissões.</p>}
    {sucesso && <p role="status" className="text-sm text-emerald-300">Visibilidade do pipeline publicada.</p>}
  </section>;
}
