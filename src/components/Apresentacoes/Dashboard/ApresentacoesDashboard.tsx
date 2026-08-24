"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, MonitorPlay, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ListarApresentacoes } from "@/actions/apresentacoes";
import { getTema } from "@/lib/temas";
import { CardApresentacao, type ApresentacaoCard } from "./CardApresentacao";
import { ModalNovaApresentacao } from "./ModalNovaApresentacao";

const DEBOUNCE_MS = 400;
const PAGE_SIZE = 24;

interface ApresentacoesDashboardProps {
  temaName?: string;
  usuarioAtualId: number;
}

export function ApresentacoesDashboard({ temaName = "blue", usuarioAtualId }: ApresentacoesDashboardProps) {
  const tema = getTema(temaName);
  const accent = tema.accent;

  const [apresentacoes, setApresentacoes] = useState<ApresentacaoCard[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBusca(buscaInput);
      setPage(1);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [buscaInput]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    try {
      const res = await ListarApresentacoes({ page, pageSize: PAGE_SIZE, busca });
      if (res.success && Array.isArray(res.data)) {
        setApresentacoes(res.data as unknown as ApresentacaoCard[]);
        setTotal(res.total ?? res.data.length);
        setTotalPages(res.totalPages ?? 1);
      } else {
        setApresentacoes([]);
        setErro(true);
        if (res.error) toast.error(typeof res.error === "string" ? res.error : "Erro ao buscar apresentações");
      }
    } catch {
      setApresentacoes([]);
      setErro(true);
      toast.error("Falha na comunicação com o servidor");
    } finally {
      setCarregando(false);
    }
  }, [page, busca]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregarDados();
  }, [carregarDados]);

  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-200 font-sans pb-20">
      <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-8 space-y-8">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 p-10 rounded-[2.5rem] backdrop-blur-2xl shadow-2xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, rgba(${accent},0.16) 0%, rgba(2,6,23,0.5) 55%, rgba(2,6,23,0.3) 100%)`,
            border: `1px solid rgba(${accent},0.22)`,
          }}
        >
          <div className="relative flex items-center gap-4">
            <div
              className="p-3 rounded-2xl border"
              style={{ background: `rgba(${accent},0.2)`, borderColor: `rgba(${accent},0.2)` }}
            >
              <MonitorPlay className="w-7 h-7" style={{ color: `rgba(${accent},1)` }} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-white italic leading-none">
                <span style={{ color: `rgba(${accent},1)` }}>Alpha</span> Motion
              </h1>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] mt-1 ml-1" style={{ color: `rgba(${accent},0.6)` }}>
                APRESENTAÇÕES INTERATIVAS ALPHA
              </p>
            </div>
          </div>

          <button
            onClick={() => setModalNovaAberto(true)}
            className="cursor-pointer relative flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors hover:bg-slate-100 active:scale-95 shadow-xl shadow-white/5"
          >
            <Plus size={16} strokeWidth={3} aria-hidden="true" />
            Nova apresentação
          </button>
        </motion.header>

        <div className="relative flex flex-col sm:flex-row gap-4 items-stretch sm:items-center bg-slate-950/70 p-4 rounded-3xl border border-white/5 backdrop-blur-2xl">
          <div className="w-full sm:w-96 relative shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar por título ou cliente..."
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              aria-label="Buscar apresentações"
              className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-indigo-500/40 transition-all"
            />
          </div>
          <span className="text-xs text-slate-500 sm:ml-auto">
            {total} apresentaç{total === 1 ? "ão" : "ões"}
          </span>
        </div>

        {carregando ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 rounded-[2rem] bg-slate-900/40 animate-pulse" />
            ))}
          </div>
        ) : erro ? (
          <div className="flex flex-col items-center gap-3 py-32 text-slate-500">
            <p className="text-sm font-medium">Não foi possível carregar as apresentações.</p>
            <button
              onClick={() => void carregarDados()}
              className="cursor-pointer text-xs font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        ) : apresentacoes.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-32 text-slate-500">
            <MonitorPlay size={40} className="text-slate-700" aria-hidden="true" />
            <p className="text-sm font-medium">
              {busca ? "Nenhum resultado para esta busca." : "Nenhuma apresentação ainda."}
            </p>
            {!busca && (
              <button
                onClick={() => setModalNovaAberto(true)}
                className="cursor-pointer text-xs font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Criar a primeira apresentação
              </button>
            )}
          </div>
        ) : (
          <>
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            >
              {apresentacoes.map((ap) => (
                <motion.div key={ap.id} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
                  <CardApresentacao
                    apresentacao={ap}
                    accent={accent}
                    onAlterado={carregarDados}
                    usuarioAtualId={usuarioAtualId}
                  />
                </motion.div>
              ))}
            </motion.div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Página anterior"
                  className="cursor-pointer p-2 rounded-xl border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <span className="text-xs font-bold text-slate-400">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Próxima página"
                  className="cursor-pointer p-2 rounded-xl border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ModalNovaApresentacao open={modalNovaAberto} onOpenChange={setModalNovaAberto} />
    </div>
  );
}
