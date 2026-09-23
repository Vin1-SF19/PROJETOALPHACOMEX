'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Users, Video, Save, ChevronRight, Search, Loader2, Trash2, Settings } from 'lucide-react';
import { getUsers } from '@/actions/get-user';
import { useSession } from 'next-auth/react';
import { getVideos } from '@/actions/GetVideos';
import { createPresetAction, deletarPresetAction, getPresets } from '@/actions/presets';
import { toast } from 'sonner';
import GerenciadorBancoQuestoes from './presets/GerenciadorBancoQuestoes';
import ModalConfiguracaoPreset from './presets/ModalConfiguracaoPreset';
import { getTagsAction } from '@/actions/questoes';
import { useRouter } from 'next/navigation';
import type { TemaAlpha } from '@/lib/temas';

type UsuarioPreset = Awaited<ReturnType<typeof getUsers>>[number] & { name?: string; setor?: string };
type VideoPreset = Awaited<ReturnType<typeof getVideos>>[number];
type PresetListado = Awaited<ReturnType<typeof getPresets>>[number];
type TagPreset = Awaited<ReturnType<typeof getTagsAction>>[number];

export default function AlphaPresetsConfig({ temaConfig, userName }: {
  temaConfig: TemaAlpha;
  userName?: string;
  videosDoSkills?: VideoPreset[];
  usuariosCadastrados?: UsuarioPreset[];
}) {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [usersList, setUsersList] = useState<UsuarioPreset[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [videosList, setVideosList] = useState<VideoPreset[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [presetsExistentes, setPresetsExistentes] = useState<PresetListado[]>([]);
  const [presetEmEdicao, setPresetEmEdicao] = useState<PresetListado | null>(null);
  const [bancoDeQuestoes] = useState<TagPreset['perguntas']>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [showBancoQuestoes, setShowBancoQuestoes] = useState(false);
  const [todasAsTags, setTodasAsTags] = useState<TagPreset[]>([]);
  const router = useRouter();
  const [confirmarDelete, setConfirmarDelete] = useState<string | null>(null);

  const [novoPreset, setNovoPreset] = useState({
    nome: '',
    videosSelecionados: [] as string[],
    usuariosVinculados: [] as string[]
  });

  const questoesDisponiveisDasTags = useMemo(() => {
    return bancoDeQuestoes;
  }, [bancoDeQuestoes]);

  const toggleQuestao = (id: string) => {
    setSelecionadas(prev => {
      if (prev.includes(id)) return prev.filter(qId => qId !== id);
      if (prev.length >= 10) {
        toast.error("Limite de 10 questões atingido!");
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleDeletar = async (id: string) => {
    const loadingToast = toast.loading("Removendo Preset...");
    try {
      const res = await deletarPresetAction(id);
      if (res.success) {
        setPresetsExistentes(prev => prev.filter(p => p.id !== id));
        toast.success("Preset removido com sucesso.");
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error("Erro na conexão.");
    } finally {
      setConfirmarDelete(null);
      toast.dismiss(loadingToast);
    }
  };

  useEffect(() => {
    const carregarDadosIniciais = async () => {
      try {
        const [users, videos, presets, tagsDoBanco] = await Promise.all([
          getUsers(),
          getVideos(),
          getPresets(),
          getTagsAction()
        ]);
        setUsersList(users || []);
        setVideosList(videos || []);
        setPresetsExistentes(presets || []);
        setTodasAsTags(tagsDoBanco || []);
      } catch (error) {
        console.error("Erro na sincronização:", error);
      } finally {
        setLoading(false);
        setLoadingVideos(false);
      }
    };
    carregarDadosIniciais();
  }, []);

  const filteredUsers = useMemo(() => {
    return usersList.filter(u =>
      (u.name || u.nome || u.usuario || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.setor || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [usersList, searchTerm]);

  const toggleVideo = (id: string) => {
    setNovoPreset(prev => ({
      ...prev,
      videosSelecionados: prev.videosSelecionados.includes(id)
        ? prev.videosSelecionados.filter(v => v !== id)
        : [...prev.videosSelecionados, id]
    }));
  };

  const toggleUser = (id: string) => {
    setNovoPreset(prev => ({
      ...prev,
      usuariosVinculados: prev.usuariosVinculados.includes(id)
        ? prev.usuariosVinculados.filter(u => u !== id)
        : [...prev.usuariosVinculados, id]
    }));
  };

  const handleSalvar = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const res = await createPresetAction({
        nome: novoPreset.nome,
        videosIds: novoPreset.videosSelecionados,
        usuariosIds: novoPreset.usuariosVinculados,
        perguntas: []
      });

      if (res.success && res.data) {
        toast.success("Preset Alpha criado com sucesso!");

        setPresetsExistentes(prev => [res.data, ...prev]);

        setNovoPreset({
          nome: '',
          videosSelecionados: [],
          usuariosVinculados: []
        });
        setSearchTerm("");
      } else {
        toast.error("Erro ao salvar: " + res.error);
      }
    } catch (err) {
      toast.error("Falha na conexão com o banco.");
    } finally {
      setIsSaving(false);
    }
  };

  const userImage = session?.user?.imagemUrl;
  const fotoFinal = userImage || session?.user?.imagemUrl;
  const initials = userName?.substring(0, 2).toUpperCase() || "OP";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6">

      <div className="lg:col-span-7 space-y-6">
        <section className={`bg-slate-900/20 backdrop-blur-md border ${temaConfig.border} p-8 rounded-[2.5rem] shadow-2xl`}>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
              <Plus size={16} className={temaConfig.text} /> Novo Preset de Treinamento
            </h2>

            <button
              onClick={() => setShowBancoQuestoes(true)}
              className="cursor-pointer p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-500 hover:text-white transition-all group"
              title="Gerenciar Banco de Questões"
            >
              <Settings size={16} className="group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Identificação do Preset</label>
              <input
                type="text"
                value={novoPreset.nome}
                onChange={(e) => setNovoPreset({ ...novoPreset, nome: e.target.value })}
                placeholder="Ex: Integração Vendas Nível 1"
                className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-6 text-sm font-bold focus:border-orange-500/50 outline-none transition-all text-white"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[9px] font-black uppercase text-slate-500 ml-2 flex items-center gap-2">
                <Video size={14} className={temaConfig.text} /> Selecionar Aulas do Skills ({novoPreset.videosSelecionados.length})
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {loadingVideos ? (
                  <div className="py-10 flex flex-col items-center opacity-20">
                    <Loader2 className="animate-spin mb-2" size={20} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Sincronizando banco de vídeos...</span>
                  </div>
                ) : videosList.map((video) => (
                  <label
                    key={video.id}
                    className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer group ${novoPreset.videosSelecionados.includes(video.id)
                      ? 'bg-white/10 border-orange-500/40 shadow-lg shadow-orange-600/5'
                      : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/[0.07]'
                      }`}
                  >
                    <div className="relative w-20 h-12 bg-black rounded-lg overflow-hidden shrink-0 border border-white/10 shadow-inner">
                      {video.thumbUrl ? (
                        <img
                          src={video.thumbUrl}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                          alt={video.titulo}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900">
                          <Video size={14} className="text-slate-700" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-40" />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <span className={`text-[11px] font-black uppercase italic truncate ${novoPreset.videosSelecionados.includes(video.id) ? temaConfig.text : 'text-slate-300'
                        }`}>
                        {video.titulo}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[7px] font-black text-slate-600 uppercase tracking-[0.2em] px-1.5 py-0.5 bg-black/40 rounded-md border border-white/5">
                          {video.setor || "Geral"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center pr-2">
                      <input
                        type="checkbox"
                        checked={novoPreset.videosSelecionados.includes(video.id)}
                        onChange={() => toggleVideo(video.id)}
                        className="w-5 h-5 rounded-lg accent-orange-600 cursor-pointer transition-transform active:scale-90"
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

        </section>
        <div className="lg:col-span-12 mt-12">
          <section className={`bg-slate-900/20 backdrop-blur-md border ${temaConfig.border} p-8 rounded-[2.5rem] shadow-2xl`}>
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-8 flex items-center gap-3">
              <ChevronRight size={16} className={temaConfig.text} /> Presets Ativos no Sistema
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {presetsExistentes.map((preset) => (
                <div key={preset.id} className="p-6 bg-white/5 border border-white/5 rounded-[2rem] hover:border-white/10 transition-all relative overflow-hidden group">
                  <div className="relative z-10">
                    <h3 className="text-sm font-black uppercase italic text-white mb-4">{preset.nome}</h3>

                    <div className="flex gap-4 mb-4 text-[9px] font-black uppercase tracking-widest">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Video size={12} className={temaConfig.text} /> {preset.videos?.length || 0} Aulas
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Users size={12} className={temaConfig.text} /> {preset.usuarios?.length || 0} Alunos
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setPresetEmEdicao(preset)}
                        className="cursor-pointer flex-1 h-10 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all"
                      >
                        Modificar Preset
                      </button>

                      <button
                        onClick={() => setConfirmarDelete(preset.id)}
                        className="w-10 h-10 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Glow sutil no card */}
                  <div className={`absolute -right-4 -top-4 w-20 h-20 ${temaConfig.glow} blur-2xl opacity-10 group-hover:opacity-20 transition-opacity`} />
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>


      {presetEmEdicao && (
        <ModalConfiguracaoPreset
          presetId={presetEmEdicao.id}
          tagsDisponiveis={todasAsTags}
          temaConfig={temaConfig}
          onClose={() => {
            setPresetEmEdicao(null);
            router.refresh();
          }}
        />
      )}

      {/* COLUNA DIREITA: VINCULAR USUÁRIOS */}
      <div className="lg:col-span-5 space-y-6">
        <section className={`bg-slate-900/20 backdrop-blur-md border ${temaConfig.border} p-8 rounded-[2.5rem] shadow-2xl h-full flex flex-col`}>
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-8 flex items-center gap-3">
            <Users size={16} className={temaConfig.text} /> Vincular Colaboradores ({novoPreset.usuariosVinculados.length})
          </h2>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou setor..."
              className="w-full h-12 bg-black/40 border border-white/5 rounded-xl pl-12 pr-4 text-xs font-bold outline-none text-white focus:border-white/20"
            />
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-20">
                <Loader2 className="animate-spin mb-4" size={32} />
                <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando Banco...</span>
              </div>
            ) : filteredUsers.map((user) => {
              const estaOcupado = presetsExistentes.some((preset) =>
                preset.usuarios.some((vinculado) => vinculado.id === user.id)
              );
              const selecionado = novoPreset.usuariosVinculados.includes(String(user.id));

              return (
                <label
                  key={user.id}
                  className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${selecionado ? 'bg-white/10 border-orange-500/40' : 'bg-white/5 border-white/5'
                    } ${estaOcupado && !selecionado ? 'opacity-50 grayscale-[0.5]' : ''}`}
                >
                  <div className="h-10 w-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
                    {user.imagemUrl ? (
                      <img src={user.imagemUrl} alt="Perfil" className="h-full w-full object-cover" />
                    ) : (
                      <span className={`font-black text-[10px] ${temaConfig.text}`}>
                        {(user.name || user.nome || "OP").substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-black uppercase text-white leading-none">
                        {user.name || user.nome || user.usuario}
                      </p>
                      {estaOcupado && (
                        <span className="text-[7px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded font-black">OCUPADO</span>
                      )}
                    </div>
                    <p className="text-[9px] font-bold text-slate-600 uppercase mt-1">
                      {user.setor || user.role || "Geral"}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selecionado}
                    onChange={() => toggleUser(String(user.id))}
                    className="w-5 h-5 accent-orange-600 cursor-pointer"
                  />
                </label>
              );
            })}
          </div>

          <button
            onClick={handleSalvar}
            disabled={novoPreset.videosSelecionados.length === 0 || !novoPreset.nome || isSaving}
            className={`w-full mt-8 h-14 ${temaConfig.bg} rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl ${temaConfig.shadow} hover:brightness-110 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed`}
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {isSaving ? "Gravando..." : "Finalizar Preset"}
          </button>

        </section>
      </div>



      {showBancoQuestoes && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            onClick={() => setShowBancoQuestoes(false)}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`relative w-full max-w-3xl bg-slate-900 border ${temaConfig.border} rounded-[2.5rem] shadow-2xl p-8`}
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-sm font-black uppercase italic text-white flex items-center gap-2">
                  <Settings size={18} className={temaConfig.text} /> Banco de Questões Alpha
                </h2>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Gerenciamento Global de Conhecimento</p>
              </div>
              <button
                onClick={() => setShowBancoQuestoes(false)}
                className="text-[10px] font-black text-slate-500 hover:text-white p-2"
              >
                FECHAR
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <GerenciadorBancoQuestoes temaConfig={temaConfig} />
            </div>

          </motion.div>
        </div>
      )}
      {/* MODAL DE CONFIRMAÇÃO DE DELETE */}
      <AnimatePresence>
        {confirmarDelete && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmarDelete(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <Trash2 className="text-red-500" size={28} />
              </div>
              <h3 className="text-lg font-black uppercase italic text-white tracking-tighter">Eliminar Preset?</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase mt-2 tracking-widest leading-relaxed">
                Esta ação é irreversível. Todos os vínculos de alunos e aulas serão rompidos.
              </p>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setConfirmarDelete(null)}
                  className="flex-1 h-12 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-slate-400 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeletar(confirmarDelete)}
                  className="flex-1 h-12 bg-red-600 hover:bg-red-700 rounded-xl text-[10px] font-black uppercase text-white shadow-lg shadow-red-900/20 transition-all"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
