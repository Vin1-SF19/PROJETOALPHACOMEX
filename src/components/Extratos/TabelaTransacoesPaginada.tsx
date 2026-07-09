"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatarDataTransacao, formatarValorBRL } from "./lib/formatters";

export interface TransacaoTabela {
  id: string;
  data: Date | string | null;
  dataOriginalTexto: string | null;
  descricao: string;
  valor: number;
}

interface ResultadoPaginado<T> {
  success: boolean;
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

interface TabelaTransacoesPaginadaProps {
  carregarPagina: (params: { page: number; pageSize: number; busca: string }) => Promise<ResultadoPaginado<TransacaoTabela>>;
  onSelecaoExcluir?: (ids: string[]) => Promise<void>;
  pageSize?: number;
}

const DEBOUNCE_MS = 400;

export function TabelaTransacoesPaginada({
  carregarPagina,
  onSelecaoExcluir,
  pageSize = 25,
}: TabelaTransacoesPaginadaProps) {
  const [transacoes, setTransacoes] = useState<TransacaoTabela[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
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

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await carregarPagina({ page, pageSize, busca });
    if (res.success) {
      const totalPagesResultado = res.totalPages ?? 1;
      // Página atual ficou além do total (ex: exclusão em lote esvaziou a
      // última página) — volta para a última página válida em vez de deixar
      // o usuário preso numa página vazia indistinguível de "sem dados".
      if (page > totalPagesResultado) {
        setCarregando(false);
        setPage(totalPagesResultado);
        return;
      }
      setTransacoes(res.data);
      setTotal(res.total ?? res.data.length);
      setTotalPages(totalPagesResultado);
    }
    setCarregando(false);
    setSelecionados(new Set());
  }, [carregarPagina, page, pageSize, busca]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  const toggleSelecionar = (id: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const toggleTodos = () => {
    setSelecionados((prev) =>
      prev.size === transacoes.length ? new Set() : new Set(transacoes.map((t) => t.id)),
    );
  };

  const handleExcluirSelecionados = async () => {
    if (!onSelecaoExcluir || selecionados.size === 0) return;
    await onSelecaoExcluir(Array.from(selecionados));
    await carregar();
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white/5 p-4 rounded-[2rem] border border-white/10">
        <div className="relative flex-1 w-full lg:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="BUSCAR TRANSAÇÃO..."
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
            aria-label="Buscar transação por descrição"
            className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-[11px] font-bold text-white uppercase outline-none focus:border-indigo-500/50 transition-all"
          />
        </div>

        {selecionados.size > 0 && onSelecaoExcluir && (
          <button
            onClick={handleExcluirSelecionados}
            className="flex items-center gap-2 px-5 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-500/20 transition-all"
          >
            <Trash2 size={14} aria-hidden="true" /> Excluir {selecionados.size} selecionado(s)
          </button>
        )}
      </div>

      <div className="bg-black/20 rounded-[2.5rem] border border-white/5 overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02] text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">
              {onSelecaoExcluir && (
                <th className="px-6 py-5 w-10">
                  <input
                    type="checkbox"
                    checked={transacoes.length > 0 && selecionados.size === transacoes.length}
                    onChange={toggleTodos}
                    aria-label="Selecionar todas as transações desta página"
                    className="w-4 h-4 rounded border-white/10 cursor-pointer"
                  />
                </th>
              )}
              <th className="px-6 py-5">Data</th>
              <th className="px-6 py-5">Descrição</th>
              <th className="px-6 py-5 text-right">Valor (R$)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {carregando ? (
              <tr>
                <td colSpan={4} className="py-16 text-center text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em] animate-pulse">
                  Carregando...
                </td>
              </tr>
            ) : transacoes.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-16 text-center text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  Nenhuma transação encontrada.
                </td>
              </tr>
            ) : (
              transacoes.map((t) => (
                <tr key={t.id} className={`group transition-colors ${selecionados.has(t.id) ? "bg-indigo-500/5" : "hover:bg-white/[0.02]"}`}>
                  {onSelecaoExcluir && (
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selecionados.has(t.id)}
                        onChange={() => toggleSelecionar(t.id)}
                        aria-label={`Selecionar transação ${t.descricao}`}
                        className="w-4 h-4 rounded border-white/10 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 text-[12px] font-bold text-slate-400 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      {!t.data && <Badge variant="outline" className="text-amber-400 border-amber-500/30">data incerta</Badge>}
                      <span className={!t.data ? "italic text-slate-500" : ""}>
                        {formatarDataTransacao(t.data, t.dataOriginalTexto)}
                      </span>
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-black text-white uppercase italic tracking-tight">{t.descricao}</div>
                  </td>
                  <td className={`px-6 py-4 text-right text-[15px] font-black ${t.valor < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                    {formatarValorBRL(t.valor)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {total} transaç{total === 1 ? "ão" : "ões"} · página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Página anterior"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-white transition-all"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Próxima página"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-white transition-all"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
