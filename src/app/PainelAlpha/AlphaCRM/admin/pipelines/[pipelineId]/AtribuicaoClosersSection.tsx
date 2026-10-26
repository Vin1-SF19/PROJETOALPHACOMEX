"use client";

import { useEffect, useState } from "react";
import { LerAtribuicaoClosersBpm, SalvarAtribuicaoClosersBpm } from "@/actions/bpm/AtribuicaoClosers";

type Configuracao = Extract<Awaited<ReturnType<typeof LerAtribuicaoClosersBpm>>, { success: true }> ["data"];

export function AtribuicaoClosersSection({ pipelineId, publicationBlocked }: { pipelineId: string; publicationBlocked: boolean }) {
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [ativa, setAtiva] = useState(false);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void LerAtribuicaoClosersBpm(pipelineId).then((resultado) => {
      if (cancelled) return;
      if (!resultado.success) { setErro(resultado.error); setConfig(null); return; }
      setConfig(resultado.data);
      setAtiva(resultado.data.ativa);
      setSelecionados(resultado.data.usuariosIds);
      setErro(null);
    }).catch(() => {
      if (!cancelled) setErro("Não foi possível carregar a configuração. Tente novamente.");
    }).finally(() => { if (!cancelled) setCarregando(false); });
    return () => { cancelled = true; };
  }, [pipelineId, revision]);

  async function salvar() {
    if (!config || salvando || publicationBlocked) return;
    setSalvando(true); setErro(null); setSucesso(false);
    try {
      const resultado = await SalvarAtribuicaoClosersBpm({
        pipelineId,
        ativa,
        usuariosIds: selecionados,
        versao: config.versao,
      });
      if (!resultado.success) { setErro(resultado.error); return; }
      setConfig({ ...config, ativa, usuariosIds: selecionados, versao: resultado.versao });
      setSucesso(true);
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const selecionadosIndisponiveis = selecionados.filter((id) => !config?.usuarios.some((usuario) => usuario.id === id));

  return <section className="space-y-4 rounded-xl border border-white/10 p-4" aria-labelledby="atribuicao-closers-heading">
    <div>
      <h2 id="atribuicao-closers-heading" className="text-sm font-bold text-white">Distribuição automática entre closers</h2>
      <p className="mt-1 text-sm text-slate-400">Novos cards e leads recebidos no pipeline Revisão de Radar entram no rodízio configurado aqui. A distribuição usa closers online; se todos estiverem offline, considera todos os selecionados elegíveis.</p>
    </div>
    {erro && <div role="alert" className="text-sm text-rose-300">{erro} <button type="button" onClick={() => { setCarregando(true); setConfig(null); setRevision((value) => value + 1); }} className="underline">Recarregar</button></div>}
    {carregando ? <p role="status" className="text-sm text-slate-400">Carregando configuração…</p> : config && <>
      <label className="flex items-center gap-3 text-sm text-slate-200">
        <input type="checkbox" checked={ativa} disabled={salvando || publicationBlocked} onChange={(event) => { setAtiva(event.target.checked); setSucesso(false); }} />
        Ativar atribuição automática
      </label>
      <fieldset disabled={salvando || publicationBlocked} className="space-y-2">
        <legend className="text-sm font-semibold text-white">Closers que podem receber novos leads</legend>
        {config.usuarios.length === 0 ? <p className="text-xs text-amber-200">Não há usuários ativos elegíveis neste pipeline.</p> : <div className="grid gap-2 sm:grid-cols-2">
          {config.usuarios.map((usuario) => <label key={usuario.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200">
            <input type="checkbox" checked={selecionados.includes(usuario.id)} onChange={(event) => {
              setSelecionados((ids) => event.target.checked ? [...new Set([...ids, usuario.id])] : ids.filter((id) => id !== usuario.id));
              setSucesso(false);
            }} />
            {usuario.nome}
          </label>)}
        </div>}
        {selecionadosIndisponiveis.length > 0 && <div className="space-y-1 text-xs text-amber-200">
          <p>Remova usuários que deixaram de estar elegíveis antes de publicar:</p>
          {selecionadosIndisponiveis.map((id) => <label key={id} className="flex items-center gap-2">
            <input type="checkbox" checked onChange={() => { setSelecionados((ids) => ids.filter((value) => value !== id)); setSucesso(false); }} />
            Usuário indisponível ({id})
          </label>)}
        </div>}
      </fieldset>
      <p className="text-xs text-slate-400">O sistema considera online quem enviou heartbeat nos últimos 60 segundos. Leads sem closer elegível ficam pendentes e são reavaliados pelo processamento do CRM.</p>
      <button type="button" disabled={salvando || publicationBlocked || (ativa && selecionados.length === 0)} onClick={() => void salvar()} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50">
        {salvando ? "Salvando…" : "Salvar distribuição"}
      </button>
      {sucesso && <p role="status" className="text-sm text-emerald-300">Configuração de distribuição salva.</p>}
    </>}
    {publicationBlocked && <p className="text-xs text-amber-200">Publique ou descarte o rascunho principal antes de alterar esta configuração.</p>}
  </section>;
}
