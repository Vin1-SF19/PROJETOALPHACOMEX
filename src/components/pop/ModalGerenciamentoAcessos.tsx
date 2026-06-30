"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, RefreshCw, Save, Shield, Upload, History } from "lucide-react";
import { toast } from "sonner";
import {
  getMatrizAcessos,
  salvarAcessos,
  type UsuarioMatriz,
  type AcessoPayload,
} from "@/actions/PopAcessos";
import { SETOR_GERAL } from "@/lib/pop-acessos";

const SETORES_EXTRAS = [
  "T.I",
  "OPERACIONAL",
  "COMERCIAL",
  "RECURSOS HUMANOS",
  "FINANCEIRO",
  "JURÍDICO",
  "PARCEIRO",
  "SERVIÇOS GERAIS",
];

interface Props {
  onClose: () => void;
}

type AcessosLocais = Record<number, Set<string>>;
type AcessosGeraisLocais = Record<number, { podeUpload: boolean; podeGerenciar: boolean }>;

export default function ModalGerenciamentoAcessos({ onClose }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioMatriz[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroProprio, setFiltroProprio] = useState("");
  const [acessosLocais, setAcessosLocais] = useState<AcessosLocais>({});
  const [acessosGeraisLocais, setAcessosGeraisLocais] = useState<AcessosGeraisLocais>({});
  const [modificados, setModificados] = useState<Set<number>>(new Set());

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMatrizAcessos();
      if (res.success && res.data) {
        setUsuarios(res.data);
        const inicial: AcessosLocais = {};
        const iniciaisGerais: AcessosGeraisLocais = {};
        for (const u of res.data) {
          inicial[u.id] = new Set(u.acessos.filter((a) => a.podeVer).map((a) => a.setor));
          iniciaisGerais[u.id] = { podeUpload: u.podeUploadGeral, podeGerenciar: u.podeGerenciarGeral };
        }
        setAcessosLocais(inicial);
        setAcessosGeraisLocais(iniciaisGerais);
        setModificados(new Set());
      } else {
        toast.error(res.error ?? "Erro ao carregar");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const toggleAcesso = (usuarioId: number, setor: string, setorProprio: string) => {
    if (setor.toUpperCase().trim() === setorProprio.toUpperCase().trim()) return;

    setAcessosLocais((prev) => {
      const novo = new Set(prev[usuarioId] ?? []);
      if (novo.has(setor)) {
        novo.delete(setor);
      } else {
        novo.add(setor);
      }
      return { ...prev, [usuarioId]: novo };
    });

    setModificados((prev) => new Set(prev).add(usuarioId));
  };

  const toggleAcessoGeral = (usuarioId: number, campo: "podeUpload" | "podeGerenciar") => {
    setAcessosGeraisLocais((prev) => {
      const atual = prev[usuarioId] ?? { podeUpload: false, podeGerenciar: false };
      return { ...prev, [usuarioId]: { ...atual, [campo]: !atual[campo] } };
    });
    setModificados((prev) => new Set(prev).add(usuarioId));
  };

  const handleSalvar = async () => {
    if (modificados.size === 0) {
      toast.info("Nenhuma alteração detectada");
      return;
    }

    setSalvando(true);
    try {
      const payloadFinal: AcessoPayload[] = [];

      for (const userId of modificados) {
        const u = usuarios.find((u) => u.id === userId);
        if (!u) continue;
        const setorProprio = u.setorProprio.toUpperCase().trim();
        const acessosDessesUsuario = acessosLocais[userId] ?? new Set<string>();

        for (const setor of SETORES_EXTRAS) {
          if (setor.toUpperCase().trim() === setorProprio) continue;
          if (acessosDessesUsuario.has(setor)) {
            payloadFinal.push({ usuarioId: userId, setor, podeVer: true, podeUpload: false, podeGerenciar: false });
          }
        }

        // Linha reservada com os acessos GERAIS aos botões Upload/Gerenciar do header
        const geral = acessosGeraisLocais[userId] ?? { podeUpload: false, podeGerenciar: false };
        if (geral.podeUpload || geral.podeGerenciar) {
          payloadFinal.push({
            usuarioId: userId,
            setor: SETOR_GERAL,
            podeVer: true,
            podeUpload: geral.podeUpload,
            podeGerenciar: geral.podeGerenciar,
          });
        }
      }

      // Passa modificados como usuariosAfetados: backend faz deleteMany mesmo
      // para usuários que removeram todos os acessos extras (sem itens no payload)
      const res = await salvarAcessos(payloadFinal, [...modificados]);
      if (res.success) {
        toast.success("Acessos salvos com sucesso");
        await carregar();
      } else {
        toast.error(res.error ?? "Erro ao salvar");
      }
    } finally {
      setSalvando(false);
    }
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    const matchBusca = u.nome.toLowerCase().includes(busca.toLowerCase());
    const matchSetor = !filtroProprio || u.setorProprio === filtroProprio;
    return matchBusca && matchSetor;
  });

  const setoresProprios = [...new Set(usuarios.map((u) => u.setorProprio))].sort();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-7xl bg-slate-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Shield size={18} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-white">Gerenciamento de Acessos ao POP</h2>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-0.5">
                  Setor próprio sempre acessível · Acessos extras gerenciados aqui
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={carregar}
                disabled={loading}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all disabled:opacity-40"
                title="Recarregar"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar usuário..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-[10px] font-bold text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40 transition-all"
              />
            </div>
            <select
              value={filtroProprio}
              onChange={(e) => setFiltroProprio(e.target.value)}
              className="bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-blue-500/40 transition-all"
            >
              <option value="">Todos os setores</option>
              {setoresProprios.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Tabela */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500 text-xs font-black uppercase">
                Carregando...
              </div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-slate-600 text-xs font-black uppercase">
                Nenhum usuário encontrado
              </div>
            ) : (
              <table className="w-full min-w-max">
                <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm">
                  <tr className="border-b border-white/5">
                    <th className="text-left px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 w-52">
                      Usuário
                    </th>
                    <th className="text-center px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
                      Próprio
                    </th>
                    {SETORES_EXTRAS.map((s) => (
                      <th key={s} className="text-center px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">
                        {s.split(" ")[0]}
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 text-[9px] font-black uppercase tracking-widest text-blue-400 whitespace-nowrap border-l border-white/10">
                      <span className="flex items-center justify-center gap-1"><Upload size={11} /> Upload</span>
                    </th>
                    <th className="text-center px-3 py-3 text-[9px] font-black uppercase tracking-widest text-blue-400 whitespace-nowrap">
                      <span className="flex items-center justify-center gap-1"><History size={11} /> Gerenciar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((u) => {
                    const modificado = modificados.has(u.id);
                    return (
                      <tr
                        key={u.id}
                        className={`border-b border-white/5 transition-colors hover:bg-white/[0.02] ${modificado ? "bg-blue-500/[0.03]" : ""}`}
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[9px] font-black text-slate-400 shrink-0">
                              {u.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-white truncate max-w-[140px]">{u.nome}</p>
                              <p className="text-[8px] text-slate-600 uppercase">{u.setorProprio}</p>
                            </div>
                          </div>
                        </td>
                        {/* Próprio setor — sempre marcado, desabilitado */}
                        <td className="text-center px-3 py-3">
                          <div className="flex justify-center">
                            <div className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                            </div>
                          </div>
                        </td>
                        {/* Acessos extras */}
                        {SETORES_EXTRAS.map((setor) => {
                          const setorProprio = u.setorProprio;
                          const ehProprio = setor.toUpperCase().trim() === setorProprio.toUpperCase().trim();
                          const ativo = ehProprio || (acessosLocais[u.id]?.has(setor) ?? false);

                          return (
                            <td key={setor} className="text-center px-3 py-3">
                              <div className="flex justify-center">
                                <button
                                  onClick={() => toggleAcesso(u.id, setor, setorProprio)}
                                  disabled={ehProprio}
                                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                    ehProprio
                                      ? "bg-emerald-500/20 border-emerald-500/40 cursor-not-allowed"
                                      : ativo
                                      ? "bg-blue-500/20 border-blue-500/50 hover:bg-blue-500/30"
                                      : "bg-white/5 border-white/10 hover:border-white/20"
                                  }`}
                                >
                                  {ativo && (
                                    <div className={`w-2.5 h-2.5 rounded-sm ${ehProprio ? "bg-emerald-500" : "bg-blue-400"}`} />
                                  )}
                                </button>
                              </div>
                            </td>
                          );
                        })}
                        {/* Acesso geral ao botão "Upload" do header (GerenciamentoArquivos) */}
                        <td className="text-center px-3 py-3 border-l border-white/10">
                          <div className="flex justify-center">
                            <button
                              onClick={() => toggleAcessoGeral(u.id, "podeUpload")}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                (acessosGeraisLocais[u.id]?.podeUpload ?? false)
                                  ? "bg-blue-500/20 border-blue-500/50 hover:bg-blue-500/30"
                                  : "bg-white/5 border-white/10 hover:border-white/20"
                              }`}
                            >
                              {(acessosGeraisLocais[u.id]?.podeUpload ?? false) && (
                                <div className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
                              )}
                            </button>
                          </div>
                        </td>
                        {/* Acesso geral ao botão "Gerenciar" do header (HistoricoArquivos) */}
                        <td className="text-center px-3 py-3">
                          <div className="flex justify-center">
                            <button
                              onClick={() => toggleAcessoGeral(u.id, "podeGerenciar")}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                (acessosGeraisLocais[u.id]?.podeGerenciar ?? false)
                                  ? "bg-blue-500/20 border-blue-500/50 hover:bg-blue-500/30"
                                  : "bg-white/5 border-white/10 hover:border-white/20"
                              }`}
                            >
                              {(acessosGeraisLocais[u.id]?.podeGerenciar ?? false) && (
                                <div className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
            <div className="text-[9px] font-black uppercase text-slate-500">
              {modificados.size > 0 ? (
                <span className="text-blue-400">{modificados.size} usuário{modificados.size > 1 ? "s" : ""} com alterações pendentes</span>
              ) : (
                <span>Sem alterações pendentes</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all text-[9px] font-black uppercase"
              >
                Fechar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando || modificados.size === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all text-[9px] font-black uppercase disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save size={12} />
                {salvando ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
