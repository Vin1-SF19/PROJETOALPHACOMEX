"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Loader2, Check, ChevronRight, Save, Search, Files, Trash2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { SalvarTransacoesLote } from "@/actions/transacao";
import type { PaginaComErro } from "@/types/extrato";
import { parseMoeda } from "./lib/formatters";
import { modalVariants, MODAL_PERSPECTIVE } from "./lib/modal-variants";
import { validarArquivosExtrato } from "./lib/upload-extrato";

interface LinhaExtraida {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  selecionado: boolean;
  origem?: string;
}

interface TransacaoBruta {
  data?: string;
  descricao?: string;
  valor?: number | string;
}

interface ModalUploadExtratoProps {
  isOpen: boolean;
  onClose: () => void;
  dadosContexto: { bancoId: number | string; banco: string; mes: string } | null;
  onSucesso?: () => void;
}

export function ModalUploadExtrato({ isOpen, onClose, dadosContexto, onSucesso }: ModalUploadExtratoProps) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "scanning" | "reviewing">("idle");
  const [linhasExtraidas, setLinhasExtraidas] = useState<LinhaExtraida[]>([]);
  const [filtro, setFiltro] = useState("");
  const [ordenacao, setOrdenacao] = useState("data-desc");
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [paginasComErro, setPaginasComErro] = useState<PaginaComErro[]>([]);
  const [reprocessando, setReprocessando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setArquivos([]);
      setLinhasExtraidas([]);
      setStatus("idle");
      setProgresso({ atual: 0, total: 0 });
      setFiltro("");
      setPaginasComErro([]);
      setReprocessando(false);
      setArrastando(false);
      dragCounterRef.current = 0;
    }
  }, [isOpen]);

  const processarLote = async (arquivosParaProcessar: File[] = arquivos) => {
    if (arquivosParaProcessar.length === 0) return;

    setStatus("scanning");
    setProgresso({ atual: 0, total: arquivosParaProcessar.length });

    let todasAsLinhas: LinhaExtraida[] = [];
    let todasAsPaginasComErro: PaginaComErro[] = [];

    try {
      for (let i = 0; i < arquivosParaProcessar.length; i++) {
        setProgresso((prev) => ({ ...prev, atual: i + 1 }));

        const formData = new FormData();
        formData.append("file", arquivosParaProcessar[i]);
        formData.append("bancoId", String(dadosContexto?.bancoId ?? ""));

        const res = await fetch("/api/onyx/extrato", { method: "POST", body: formData });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error || `Erro ${res.status}`);
        }

        const dados = (await res.json()) as {
          success: boolean;
          data?: TransacaoBruta[];
          error?: string;
          paginasComErro?: PaginaComErro[];
        };

        if (dados.success && Array.isArray(dados.data)) {
          const formatados = dados.data.map((item, idx) => ({
            id: `new-${i}-${idx}-${Date.now()}-${Math.random()}`,
            data: item.data ? String(item.data).trim() : "",
            descricao: item.descricao?.trim() || "LANÇAMENTO",
            valor: parseMoeda(item.valor),
            selecionado: true,
            origem: arquivosParaProcessar[i].name,
          }));
          todasAsLinhas = [...todasAsLinhas, ...formatados];
        }

        if (Array.isArray(dados.paginasComErro) && dados.paginasComErro.length > 0) {
          todasAsPaginasComErro = [...todasAsPaginasComErro, ...dados.paginasComErro];
        }
      }

      setLinhasExtraidas(todasAsLinhas);
      setPaginasComErro(todasAsPaginasComErro);
      if (todasAsPaginasComErro.length > 0) {
        toast.warning(`${todasAsPaginasComErro.length} página(s) não foram processadas. Você pode tentar reprocessá-las.`);
      }
      setStatus("reviewing");
      setArquivos([]);
    } catch (error) {
      toast.error((error as Error).message || "Erro no processamento");
      setStatus("idle");
    }
  };

  const notificarErrosDeArquivo = (erros: string[]) => {
    if (erros.length === 0) return;
    const complemento = erros.length > 1 ? ` (+${erros.length - 1} arquivo(s))` : "";
    toast.error(`${erros[0]}${complemento}`);
  };

  const selecionarArquivos = (event: ChangeEvent<HTMLInputElement>) => {
    const candidatos = Array.from(event.target.files ?? []);
    const { validos, erros } = validarArquivosExtrato(candidatos, arquivos);

    if (validos.length > 0) {
      setArquivos((prev) => [...prev, ...validos]);
    }
    notificarErrosDeArquivo(erros);
    event.target.value = "";
  };

  const iniciarArraste = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    setArrastando(true);
  };

  const manterArraste = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  };

  const encerrarArraste = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setArrastando(false);
  };

  const soltarArquivos = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setArrastando(false);

    const candidatos = Array.from(event.dataTransfer.files);
    const { validos, erros } = validarArquivosExtrato(candidatos, arquivos);
    notificarErrosDeArquivo(erros);

    if (validos.length === 0) return;

    const loteAutomatico = [...arquivos, ...validos];
    setArquivos(loteAutomatico);
    void processarLote(loteAutomatico);
  };

  const abrirSeletorPorTeclado = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    fileInputRef.current?.click();
  };

  const reprocessarPaginasComErro = async () => {
    if (paginasComErro.length === 0) return;

    setReprocessando(true);
    try {
      const res = await fetch("/api/onyx/extrato/reprocessar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paginas: paginasComErro }),
      });

      const dados = (await res.json()) as {
        success: boolean;
        data?: TransacaoBruta[];
        error?: string;
        paginasComErro?: PaginaComErro[];
      };

      if (!res.ok || !dados.success) {
        throw new Error(dados.error || `Erro ${res.status}`);
      }

      const novasLinhas = (dados.data ?? []).map((item, idx) => ({
        id: `retry-${idx}-${Date.now()}-${Math.random()}`,
        data: item.data ? String(item.data).trim() : "",
        descricao: item.descricao?.trim() || "LANÇAMENTO",
        valor: parseMoeda(item.valor),
        selecionado: true,
        origem: "reprocessado",
      }));

      setLinhasExtraidas((prev) => [...prev, ...novasLinhas]);

      const aindaComErro = dados.paginasComErro ?? [];
      setPaginasComErro(aindaComErro);

      const recuperadas = paginasComErro.length - aindaComErro.length;
      if (aindaComErro.length === 0) {
        toast.success(`Todas as páginas foram reprocessadas com sucesso (${novasLinhas.length} transações recuperadas).`);
      } else if (recuperadas > 0) {
        toast.warning(`${recuperadas} página(s) recuperada(s). ${aindaComErro.length} ainda com erro.`);
      } else {
        toast.error(`Nenhuma das ${aindaComErro.length} página(s) pôde ser reprocessada.`);
      }
    } catch (error) {
      toast.error((error as Error).message || "Erro ao reprocessar páginas");
    } finally {
      setReprocessando(false);
    }
  };

  const confirmarImportacao = async () => {
    const selecionados = linhasExtraidas.filter((l) => l.selecionado);
    if (selecionados.length === 0) return toast.error("Nenhuma transação selecionada.");
    if (!dadosContexto) return;

    toast.promise(SalvarTransacoesLote(selecionados, Number(dadosContexto.bancoId)), {
      loading: "Salvando no banco...",
      success: (res) => {
        if (!res.success) throw new Error(res.error || "Erro ao salvar");
        onSucesso?.();
        onClose();
        return "Dados importados com sucesso!";
      },
      error: (err) => (err instanceof Error ? err.message : "Erro ao salvar dados"),
    });
  };

  const atualizarCampo = (id: string, campo: keyof LinhaExtraida, valor: string | boolean) => {
    setLinhasExtraidas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [campo]: campo === "valor" ? parseMoeda(valor) : valor } : l)),
    );
  };

  const linhasFiltradas = useMemo(() => {
    return [...linhasExtraidas]
      .filter((l) => {
        const termo = filtro.toLowerCase();
        const descricaoMatch = l.descricao?.toLowerCase().includes(termo);
        const valorMatch = l.valor?.toString().includes(termo) || l.valor?.toLocaleString("pt-BR", { minimumFractionDigits: 2 }).includes(termo);
        return descricaoMatch || valorMatch;
      })
      .sort((a, b) => {
        if (ordenacao === "valor-desc") return b.valor - a.valor;
        if (ordenacao === "valor-asc") return a.valor - b.valor;
        if (ordenacao === "data-desc" || ordenacao === "data-asc") {
          const parseData = (d: string) => {
            if (!d || !d.includes("/")) return 0;
            const [dia, mes] = d.split("/").map(Number);
            return mes * 100 + dia;
          };
          const valA = parseData(a.data);
          const valB = parseData(b.data);
          return ordenacao === "data-desc" ? valB - valA : valA - valB;
        }
        return 0;
      });
  }, [linhasExtraidas, filtro, ordenacao]);

  const toggleSelecionarTodos = () => {
    const todosAtuaisSelecionados = linhasFiltradas.every((l) => l.selecionado);
    const idsFiltrados = new Set(linhasFiltradas.map((l) => l.id));
    setLinhasExtraidas((prev) =>
      prev.map((l) => (idsFiltrados.has(l.id) ? { ...l, selecionado: !todosAtuaisSelecionados } : l)),
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/95 p-2 backdrop-blur-md sm:p-4"
        style={{ perspective: MODAL_PERSPECTIVE }}
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ transformStyle: "preserve-3d" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-upload-extrato-titulo"
          className="flex h-[calc(100dvh-1rem)] min-h-0 max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#020617] shadow-2xl sm:h-[85dvh] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[3rem]"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-slate-900/20 p-4 sm:p-8">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 sm:flex">
                <Files size={24} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 id="modal-upload-extrato-titulo" className="truncate text-lg font-black uppercase italic tracking-tighter text-white sm:text-2xl">Novo Upload em Lote</h2>
                <p className="truncate text-[9px] font-bold uppercase tracking-wider text-slate-500 sm:text-[10px] sm:tracking-widest">{dadosContexto?.banco || "BANCO"} • {dadosContexto?.mes || "PERÍODO"}</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="shrink-0 rounded-full p-2 text-slate-500 transition-all hover:bg-white/5">
              <X size={24} aria-hidden="true" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
            {status === "idle" && (
              <div className="grid min-h-full grid-cols-1 lg:h-full lg:grid-cols-2">
                <div className="flex flex-col items-center justify-center border-b border-white/5 p-5 sm:p-8 lg:border-b-0 lg:border-r lg:p-12">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={abrirSeletorPorTeclado}
                    onDragEnter={iniciarArraste}
                    onDragOver={manterArraste}
                    onDragLeave={encerrarArraste}
                    onDrop={soltarArquivos}
                    role="button"
                    tabIndex={0}
                    aria-label="Arraste extratos para processar automaticamente ou pressione Enter para selecionar arquivos"
                    className={`group flex min-h-56 w-full max-w-[420px] cursor-pointer flex-col items-center justify-center gap-5 rounded-3xl border-2 border-dashed px-6 py-8 text-center outline-none transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 sm:aspect-square sm:max-w-[320px] sm:gap-6 sm:rounded-[3rem] ${
                      arrastando
                        ? "scale-[1.02] border-indigo-400 bg-indigo-500/15 shadow-[0_0_50px_rgba(99,102,241,0.2)]"
                        : "border-white/10 bg-white/5 hover:border-indigo-500/50"
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      multiple
                      accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={selecionarArquivos}
                    />
                    <div className={`flex h-16 w-16 items-center justify-center rounded-full text-indigo-500 transition-all sm:h-20 sm:w-20 ${
                      arrastando ? "bg-indigo-500 text-white" : "bg-indigo-500/10 group-hover:bg-indigo-500 group-hover:text-white"
                    }`}>
                      <Upload size={32} aria-hidden="true" />
                    </div>
                    <div className="text-center px-6">
                      <h3 className="text-sm font-black uppercase italic text-white">
                        {arrastando ? "Solte para processar" : "Arraste ou selecione"}
                      </h3>
                      <p className="mt-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                        Arrastar inicia automaticamente • seleção permite revisar a fila
                      </p>
                      <p className="mt-2 text-[9px] font-semibold text-slate-600">PDF ou Word (.docx) • até 20 MB por arquivo</p>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-[320px] flex-col overflow-hidden bg-black/20 p-5 sm:p-8 lg:min-h-0 lg:p-12">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Fila de Arquivos ({arquivos.length})</h4>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    {arquivos.map((f, i) => (
                      <div key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center justify-between gap-2 rounded-2xl border border-white/5 bg-white/5 p-3 sm:p-4">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                          <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 text-[10px] font-black italic">{i + 1}º</div>
                          <span className="max-w-[180px] truncate text-[11px] font-bold text-slate-300 sm:max-w-[300px]">{f.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <button
                              aria-label="Mover para cima"
                              onClick={() => {
                                const n = [...arquivos];
                                if (i > 0) [n[i], n[i - 1]] = [n[i - 1], n[i]];
                                setArquivos(n);
                              }}
                              className="p-1 hover:text-indigo-400 text-slate-600"
                            >
                              <Plus size={12} aria-hidden="true" />
                            </button>
                            <button
                              aria-label="Mover para baixo"
                              onClick={() => {
                                const n = [...arquivos];
                                if (i < n.length - 1) [n[i], n[i + 1]] = [n[i + 1], n[i]];
                                setArquivos(n);
                              }}
                              className="p-1 hover:text-indigo-400 text-slate-600"
                            >
                              <Minus size={12} aria-hidden="true" />
                            </button>
                          </div>
                          <button
                            aria-label="Remover arquivo"
                            onClick={() => setArquivos((prev) => prev.filter((_, idx) => idx !== i))}
                            className="p-2 text-slate-600 hover:text-rose-500"
                          >
                            <Trash2 size={18} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {arquivos.length > 0 && (
                    <button onClick={() => void processarLote()} className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-indigo-600 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-indigo-500 sm:mt-8 sm:py-5">
                      Processar com Agentes IA <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {status === "scanning" && (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-6 px-6 text-center">
                <Loader2 size={64} aria-hidden="true" className="animate-spin text-indigo-500 sm:h-20 sm:w-20" />
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">Processando arquivo {progresso.atual} de {progresso.total} via IA</p>
              </div>
            )}

            {status === "reviewing" && (
              <div className="flex h-full min-h-[540px] flex-col">
                <div className="flex flex-col gap-3 border-b border-white/5 bg-white/5 p-3 sm:flex-row sm:gap-4 sm:p-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} aria-hidden="true" />
                    <input
                      type="text"
                      placeholder="FILTRAR RESULTADOS..."
                      value={filtro}
                      onChange={(e) => setFiltro(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-[10px] font-bold text-white uppercase outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <select
                    value={ordenacao}
                    onChange={(e) => setOrdenacao(e.target.value)}
                    aria-label="Ordenar resultados"
                    className="w-full cursor-pointer rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-[12px] font-bold uppercase text-white outline-none transition-all hover:border-indigo-500/50 sm:w-auto"
                  >
                    <option value="data-desc">Mais Recentes</option>
                    <option value="data-asc">Mais Antigos</option>
                    <option value="valor-desc">Maiores Valores</option>
                    <option value="valor-asc">Menores Valores</option>
                  </select>
                </div>

                {paginasComErro.length > 0 && (
                  <div className="mx-3 mt-3 flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:mx-4 sm:mt-4 sm:flex-row sm:items-center sm:p-5">
                    <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
                      {paginasComErro.length} página(s) não processada(s). Algumas transações podem estar faltando.
                    </p>
                    <button
                      onClick={reprocessarPaginasComErro}
                      disabled={reprocessando}
                      className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-500/20 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-amber-400 transition-all hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
                    >
                      {reprocessando ? <Loader2 size={14} aria-hidden="true" className="animate-spin" /> : null}
                      {reprocessando ? "Reprocessando..." : "Reprocessar páginas com erro"}
                    </button>
                  </div>
                )}

                <div className="m-3 flex min-h-0 flex-1 flex-col overflow-auto rounded-2xl border border-white/5 bg-black/20 sm:m-4 sm:rounded-3xl">
                  <div className="flex min-h-full min-w-[760px] flex-col">
                    <div className="grid grid-cols-12 items-center gap-4 border-b border-white/5 bg-white/[0.02] px-9 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    <div className="col-span-1 flex justify-center">
                      <button
                        onClick={toggleSelecionarTodos}
                        aria-label="Selecionar todos os resultados filtrados"
                        className={`h-5 w-5 rounded-lg border-2 flex items-center justify-center ${linhasFiltradas.length > 0 && linhasFiltradas.every((l) => l.selecionado) ? "bg-indigo-500 border-indigo-500" : "border-white/10"}`}
                      >
                        {linhasFiltradas.length > 0 && linhasFiltradas.every((l) => l.selecionado) && <Check size={12} strokeWidth={4} aria-hidden="true" className="text-white" />}
                      </button>
                    </div>
                    <div className="col-span-2">Data</div>
                    <div className="col-span-6">Descrição</div>
                    <div className="col-span-3 text-right">Valor (R$)</div>
                    </div>

                    <div className="flex-1 space-y-1 overflow-y-auto p-4">
                      {linhasFiltradas.map((linha) => (
                      <motion.div layout key={linha.id} className={`grid grid-cols-12 gap-4 items-center p-2 px-5 rounded-2xl border transition-all ${linha.selecionado ? "bg-indigo-500/10 border-indigo-500/30" : "bg-white/[0.02] border-transparent opacity-60 hover:opacity-100"}`}>
                        <div className="col-span-1 flex justify-center">
                          <button
                            onClick={() => atualizarCampo(linha.id, "selecionado", !linha.selecionado)}
                            aria-label={`Selecionar transação ${linha.descricao}`}
                            className={`h-6 w-6 rounded-xl border-2 flex items-center justify-center ${linha.selecionado ? "bg-indigo-500 border-indigo-500" : "border-white/10"}`}
                          >
                            <Check size={14} strokeWidth={4} aria-hidden="true" className={linha.selecionado ? "text-white" : "text-transparent"} />
                          </button>
                        </div>
                        <div className="col-span-2">
                          <input type="text" value={linha.data} onChange={(e) => atualizarCampo(linha.id, "data", e.target.value)} aria-label="Data da transação" className="bg-white/[0.03] border border-white/5 rounded-xl px-2 py-2 text-[14px] font-black text-slate-200 w-full text-center outline-none" />
                        </div>
                        <div className="col-span-6">
                          <input type="text" value={linha.descricao} onChange={(e) => atualizarCampo(linha.id, "descricao", e.target.value)} aria-label="Descrição da transação" className="bg-transparent border-none text-[14px] font-black text-white w-full uppercase outline-none" />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            defaultValue={linha.valor.toLocaleString("pt-br", { minimumFractionDigits: 2 })}
                            onBlur={(e) => atualizarCampo(linha.id, "valor", e.target.value)}
                            aria-label="Valor da transação"
                            className="bg-white/5 border border-transparent rounded-lg px-2 py-1.5 text-[16px] font-black text-white w-full text-right outline-none font-mono"
                          />
                        </div>
                      </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {status === "reviewing" && (
            <div className="flex shrink-0 flex-col justify-between gap-3 border-t border-white/5 bg-slate-900/60 p-3 sm:flex-row sm:items-center sm:p-5 lg:p-8">
            <div className="flex gap-10">
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Novas Transações</p>
                <p className="text-xl font-black text-white italic">{linhasFiltradas.length}</p>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button onClick={() => setLinhasExtraidas((prev) => prev.filter((l) => !l.selecionado))} className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-rose-500 transition-all hover:bg-rose-500/5 sm:px-6 sm:py-4">
                <X size={14} aria-hidden="true" /> Descartar Selecionados
              </button>
              <div className="mx-2 hidden h-8 w-px bg-white/10 sm:block" />
              <button onClick={confirmarImportacao} disabled={linhasExtraidas.length === 0} className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500 disabled:opacity-20 sm:px-10 sm:py-4">
                <Save size={16} aria-hidden="true" /> Salvar Transações
              </button>
            </div>
            </div>
          )}
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
