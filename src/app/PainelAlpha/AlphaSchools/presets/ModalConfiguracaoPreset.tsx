'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Users, Database, Tag, Search, CheckCircle2,
  Circle, X, Loader2, ArrowUp, ArrowDown, UserPlus, Trash2,
  Layers, ChevronRight, AlertTriangle, ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { salvarConfiguracoesCompletasAction, getPresetCompletoAction, buscarTodosUsuariosAction } from '@/actions/questoes';
import type { getTagsAction } from '@/actions/questoes';
import type { TemaAlpha } from '@/lib/temas';

type PresetCompleto = NonNullable<Awaited<ReturnType<typeof getPresetCompletoAction>>>;
type UsuarioDisponivel = Awaited<ReturnType<typeof buscarTodosUsuariosAction>>[number];
type TagDisponivel = Awaited<ReturnType<typeof getTagsAction>>[number];
type UsuarioVinculado = { id: number; usuario: string; nome?: string; email?: string };

export default function ModalConfiguracaoPreset({
  presetId,
  tagsDisponiveis,
  temaConfig,
  onClose
}: { presetId: string; tagsDisponiveis: TagDisponivel[]; temaConfig: TemaAlpha; onClose: () => void }) {

  const [loadedPresetId, setLoadedPresetId] = useState<string | null>(null);
  const loading = loadedPresetId !== String(presetId);
  const [saving, setSaving] = useState(false);
  const [buscaAlunos, setBuscaAlunos] = useState("");
  const [showAddAluno, setShowAddAluno] = useState(false);
  const [listaUsuariosBanco, setListaUsuariosBanco] = useState<UsuarioDisponivel[]>([]);

  const [videos, setVideos] = useState<PresetCompleto['videos']>([]);
  const [usuarios, setUsuarios] = useState<UsuarioVinculado[]>([]);
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);

  const [showExpurgo, setShowExpurgo] = useState(false);

  useEffect(() => {
    let ativo = true;
    void Promise.all([
        getPresetCompletoAction(presetId),
        buscarTodosUsuariosAction()
      ]).then(([dataPreset, dataUsers]) => {
      if (!ativo) return;
      if (dataPreset) {
        setVideos(dataPreset.videos || []);
        setUsuarios(dataPreset.usuarios || []);
        setTagsSelecionadas(dataPreset.tags?.map((t) => String(t.id)) || []);
      }
      setListaUsuariosBanco(dataUsers);
    }).catch(() => {
      if (!ativo) return;
      toast.error("Erro ao carregar dados.");
    }).finally(() => {
      if (ativo) setLoadedPresetId(String(presetId));
    });
    return () => { ativo = false; };
  }, [presetId]);

  // CÁLCULO DE PERGUNTAS TOTAIS
  const perguntasDoPreset = useMemo(() => {
    return tagsDisponiveis
      .filter((t) => tagsSelecionadas.includes(String(t.id)))
      .flatMap((t) => (t.perguntas || []).map((p) => ({ ...p, tagName: t.nome })));
  }, [tagsSelecionadas, tagsDisponiveis]);

  const totalPerguntas = perguntasDoPreset.length;

  const toggleTag = (id: string) => {
    const idStr = String(id);
    setTagsSelecionadas(prev =>
      prev.includes(idStr) ? prev.filter(t => t !== idStr) : [...prev, idStr]
    );
  };

  const moverVideo = (index: number, direcao: 'sobe' | 'desce') => {
    const novaLista = [...videos];
    const destino = direcao === 'sobe' ? index - 1 : index + 1;
    if (destino < 0 || destino >= novaLista.length) return;
    [novaLista[index], novaLista[destino]] = [novaLista[destino], novaLista[index]];
    setVideos(novaLista);
  };

  const adicionarAluno = (user: UsuarioDisponivel) => {
    if (!usuarios.find((u) => String(u.id) === String(user.id))) {
      setUsuarios([...usuarios, user]);
    } else {
      toast.error("Aluno já vinculado.");
    }
    setShowAddAluno(false);
  };

  const handleSalvarTudo = async () => {
    if (totalPerguntas > 20) {
        setShowExpurgo(true);
        return;
    }

    setSaving(true);
    const loadingToast = toast.loading("Validando integridade dos usuários...");

    const res = await salvarConfiguracoesCompletasAction(
        presetId,
        videos.map((v) => v.id),
        usuarios.map((u) => String(u.id)),
        tagsSelecionadas
    );

    toast.dismiss(loadingToast);

    if (res.success) {
        toast.success("Protocolo Alpha Sincronizado!");
        onClose();
    } else {
        toast.error(res.error || "Erro desconhecido", {
            duration: 5000,
            style: { background: '#1a1a1a', border: '1px solid #ef4444', color: '#fff' }
        });
    }
    setSaving(false);
};

  if (loading) return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90"><Loader2 className="animate-spin text-white" size={40} /></div>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a0a0a]/90 backdrop-blur-md">

      {/* MODAL DE EXPURGO (OVERLAY) */}
      <AnimatePresence>
        {showExpurgo && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <div className="max-w-2xl w-full bg-[#111] border border-orange-500/30 rounded-[3rem] p-10 shadow-[0_0_100px_-20px_rgba(249,115,22,0.3)]">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center border border-orange-500/20 mb-6">
                  <ShieldAlert className="text-orange-500" size={40} />
                </div>
                <h3 className="text-3xl font-black uppercase italic text-white tracking-tighter">Excesso de Dados</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">
                  O preset permite no máximo 20 questões. Atualmente existem <span className="text-orange-500">{totalPerguntas}</span>.
                </p>
              </div>

              <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                <p className="text-[9px] font-black text-slate-600 uppercase mb-4 tracking-widest text-center italic">Desmarque tags no menu principal para reduzir</p>
                {tagsDisponiveis.filter((t) => tagsSelecionadas.includes(String(t.id))).map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black uppercase text-white">{tag.nome}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-bold text-orange-500">{tag.perguntas?.length || 0} Qs</span>
                      <button onClick={() => toggleTag(tag.id)} className="p-2 hover:bg-red-500/20 rounded-xl text-red-500 transition-all"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { if (totalPerguntas <= 20) setShowExpurgo(false); else toast.error("Ainda acima de 20!"); }}
                className={`w-full h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest mt-8 transition-all ${totalPerguntas <= 20 ? 'bg-green-600 text-white' : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'}`}
              >
                {totalPerguntas <= 20 ? "Validar e Voltar" : `Remova mais ${totalPerguntas - 20} questões`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div className="relative w-full max-w-7xl h-[92vh] flex flex-col bg-[#111111] border border-white/10 rounded-[3rem] overflow-hidden">

        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-5">
            <div className={`p-4 rounded-[1.5rem] ${temaConfig.bg} bg-opacity-10 border border-white/5`}>
              <Layers className={temaConfig.bg} size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter">
                Configurações <ChevronRight size={20} className="text-slate-600 inline" /> <span className={temaConfig.text}>Preset</span>
              </h2>
            </div>
          </div>

          {/* CONTADOR REAL-TIME NO HEADER */}
          <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border transition-all ${totalPerguntas > 20 ? 'bg-red-500/10 border-red-500/40 text-red-500' : 'bg-white/5 border-white/5 text-slate-400'}`}>
            <Database size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {totalPerguntas} / 20 Questões
            </span>
            {totalPerguntas > 20 && <AlertTriangle size={16} className="animate-pulse" />}
          </div>

          <button onClick={onClose} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-[#0d0d0d]">
          <div className="lg:col-span-5 border-r border-white/5 p-8 overflow-y-auto space-y-12 custom-scrollbar bg-gradient-to-b from-white/[0.01] to-transparent">
            {/* VÍDEOS COM MOVIMENTAÇÃO FLUÍDA */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2">
                  <Video size={14} className={temaConfig.text} /> Sequência de Aulas
                </h3>
                <span className="text-[9px] font-black px-3 py-1 bg-white/5 rounded-full border border-white/5 text-slate-500">
                  {videos.length} Módulos
                </span>
              </div>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {videos.map((video, index) => (
                    <motion.div
                      key={video.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="group flex items-center gap-4 p-3 bg-white/[0.02] border border-white/5 rounded-[2rem] hover:bg-white/[0.05] hover:border-white/10 transition-all"
                    >
                      {/* THUMBNAIL ESTILIZADA */}
                      <div className="relative w-24 h-14 rounded-[1.2rem] overflow-hidden bg-black flex-shrink-0 border border-white/10">
                        {video.thumbUrl ? (
                          <img
                            src={video.thumbUrl}
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500"
                            alt=""
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-900">
                            <Video size={16} className="text-slate-700" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <div className="absolute bottom-1.5 left-2 text-[8px] font-black text-white italic drop-shadow-md">
                          #{String(index + 1).padStart(2, '0')}
                        </div>
                      </div>

                      {/* INFO */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-white uppercase truncate tracking-tight group-hover:text-orange-500 transition-colors">
                          {video.titulo}
                        </p>
                        <p className="text-[8px] font-bold text-slate-600 uppercase mt-0.5">Módulo de Performance</p>
                      </div>

                      {/* CONTROLES DE MOVIMENTAÇÃO */}
                      <div className="flex flex-col gap-1 pr-2">
                        <button
                          onClick={() => moverVideo(index, 'sobe')}
                          disabled={index === 0}
                          className="p-2 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-all disabled:opacity-0 active:scale-90"
                        >
                          <ArrowUp size={14} strokeWidth={3} />
                        </button>
                        <button
                          onClick={() => moverVideo(index, 'desce')}
                          disabled={index === videos.length - 1}
                          className="p-2 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-all disabled:opacity-0 active:scale-90"
                        >
                          <ArrowDown size={14} strokeWidth={3} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>

            {/* ALUNOS  */}
            <section className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2">
                  <Users size={14} className={temaConfig.text} /> Alunos Vinculados
                </h3>
                <button
                  onClick={() => setShowAddAluno(!showAddAluno)}
                  className={`text-[9px] font-black uppercase px-4 py-2 rounded-xl border transition-all ${showAddAluno ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                >
                  {showAddAluno ? 'Cancelar' : '+ Vincular'}
                </button>
              </div>

              <AnimatePresence>
                {showAddAluno && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 bg-white/[0.03] border border-white/10 rounded-[2rem] mb-6 shadow-2xl"
                  >
                    <div className="relative mb-3">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                      <input
                        type="text"
                        placeholder="BUSCAR OPERADOR..."
                        className="w-full bg-black/40 border border-white/5 rounded-xl p-3 pl-11 text-[10px] font-black text-white uppercase outline-none focus:border-orange-500/30 transition-all"
                        onChange={(e) => setBuscaAlunos(e.target.value)}
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                      {listaUsuariosBanco?.filter(u => u.usuario?.toLowerCase().includes(buscaAlunos.toLowerCase())).map(u => (
                        <button
                          key={u.id}
                          onClick={() => adicionarAluno(u)}
                          className="w-full text-left p-3 rounded-lg hover:bg-white/5 flex items-center justify-between group transition-all"
                        >
                          <span className="text-[9px] font-black text-slate-500 group-hover:text-white uppercase">{u.usuario}</span>
                          <UserPlus size={14} className="text-slate-700 group-hover:text-green-500" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-2 gap-3">
                {usuarios.map((u) => (
                  <motion.div
                    layout
                    key={u.id}
                    className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between group hover:border-red-500/20 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                      <span className="text-[9px] font-black text-slate-300 uppercase truncate">{u.usuario}</span>
                    </div>
                    <button
                      onClick={() => setUsuarios(usuarios.filter((x) => x.id !== u.id))}
                      className="p-2 text-slate-700 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </section>
          </div>

          {/* GRADE DE TAGS */}
          <div className="lg:col-span-7 p-10 overflow-y-auto bg-black/40 space-y-8 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tagsDisponiveis.map((tag) => {
                const isSelected = tagsSelecionadas.includes(String(tag.id));
                const qtdQuestoes = tag.perguntas?.length || 0;

                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all duration-300 ${isSelected ? `${temaConfig.bg} bg-opacity-10 border-white/30` : 'bg-white/[0.02] border-white/5'
                      }`}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className={`p-3 rounded-xl ${isSelected ? temaConfig.bg : 'bg-white/5'}`}>
                        <Tag size={18} className={isSelected ? 'text-white' : 'text-slate-600'} />
                      </div>
                      <div>
                        <p className={`text-[11px] font-black uppercase tracking-widest ${isSelected ? 'text-white' : 'text-slate-500'}`}>{tag.nome}</p>
                        <p className="text-[8px] font-bold text-white uppercase mt-1">{qtdQuestoes} Questões no Banco</p>
                      </div>
                    </div>
                    {isSelected ? <CheckCircle2 size={20} className={temaConfig.text} /> : <Circle size={20} className="text-white/5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-white/5 bg-white/[0.01]">
          <button
            onClick={handleSalvarTudo}
            disabled={saving}
            className={`w-full h-20 ${totalPerguntas > 20 ? 'bg-red-600' : temaConfig.bg} rounded-[2rem] font-black uppercase text-sm tracking-[0.5em] text-white flex items-center justify-center gap-4 shadow-2xl transition-all`}
          >
            {saving ? <Loader2 className="animate-spin" /> : totalPerguntas > 20 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
            {totalPerguntas > 20 ? "CORRIGIR EXCESSO DE QUESTÕES" : "Sincronizar Arquivos Alpha"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
