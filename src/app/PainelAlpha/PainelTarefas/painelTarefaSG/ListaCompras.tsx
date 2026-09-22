"use client"

import { useState } from "react";
import { ShoppingCart, ArrowLeft, Package, CheckCircle2, X, Plus, Trash2, Loader2 } from "lucide-react";
import { RegistrarCompra, RemoverDaLista } from "@/actions/Estoque";
import { toast } from "sonner";

interface ItemCompra {
    id: string;
    produtoId: string;
    nome: string;
    quantidadeAtual: number;
    minimoEsperado: number;
    unidade: string;
    status: string;
    categoria?: { nome: string };
}

export default function ListaCompras({ itens, aoVoltar, atualizarDados }: {
    itens: ItemCompra[];
    aoVoltar: () => void;
    atualizarDados: () => void;
}) {
    const [itemSelecionado, setItemSelecionado] = useState<ItemCompra | null>(null);
    const [qtdComprada, setQtdComprada] = useState<string>("1");
    const [operationKey, setOperationKey] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const itensPendentes = itens.filter(item => item.status === "PENDENTE");

    const handleConfirmarCompra = async () => {
        if (!itemSelecionado) return;
        setLoading(true);
        const res = await RegistrarCompra(itemSelecionado.produtoId, Number(qtdComprada), operationKey);
        if (res.success) {
            toast.success("Estoque atualizado!");
            atualizarDados();
            setItemSelecionado(null);
            setQtdComprada("1");
            setOperationKey("");
        }
        setLoading(false);
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative">

            {itemSelecionado && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="bg-[#0c0c0e] border border-white/10 p-8 rounded-[3rem] w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Confirmar Entrada</p>
                                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-tight">
                                    {itemSelecionado.nome}
                                </h3>
                            </div>
                            <button
                                onClick={() => setItemSelecionado(null)}
                                className="p-2 text-slate-500 hover:text-white transition-colors cursor-pointer"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-8">
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase mb-4 block text-center tracking-[0.2em]">
                                    Quantidade Comprada ({itemSelecionado.unidade})
                                </label>

                                {/* CONTROLES DE QUANTIDADE PARA TABLET */}
                                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-[2rem] p-2">
                                    <button
                                        onClick={() => setQtdComprada(prev => Math.max(1, Number(prev) - 1).toString())}
                                        className="w-16 h-16 flex items-center justify-center bg-white/5 hover:bg-rose-500/20 text-white rounded-[1.5rem] transition-all active:scale-90 cursor-pointer border border-white/5"
                                    >
                                        <span className="text-3xl font-light">-</span>
                                    </button>

                                    <div className="flex flex-col items-center">
                                        <input
                                            disabled
                                            type="text"
                                            value={qtdComprada}
                                            onChange={(e) => setQtdComprada(e.target.value)}
                                            className="w-24 bg-transparent text-center text-4xl font-black text-white outline-none"
                                        />
                                        <span className="text-[10px] font-bold text-indigo-500/50 uppercase">{itemSelecionado.unidade}</span>
                                    </div>

                                    <button
                                        onClick={() => setQtdComprada(prev => (Number(prev) + 1).toString())}
                                        className="w-16 h-16 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] transition-all active:scale-90 cursor-pointer shadow-lg shadow-indigo-600/20"
                                    >
                                        <Plus size={24} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleConfirmarCompra}
                                    disabled={loading}
                                    className="cursor-pointer w-full bg-white text-black hover:bg-indigo-600 hover:text-white disabled:opacity-50 font-black py-6 rounded-[2rem] uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 transition-all cursor-pointer shadow-2xl active:scale-[0.98]"
                                >
                                    {loading ? (
                                        <Loader2 className="animate-spin" size={18} />
                                    ) : (
                                        <>
                                            <CheckCircle2 size={18} />
                                            Finalizar Compra
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => setItemSelecionado(null)}
                                    className="cursor-pointer text-[14px] hover:text-red-600 font-black text-slate-600 uppercase transition-colors py-2"
                                >
                                    Cancelar Operação
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <button onClick={aoVoltar} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors cursor-pointer text-left">
                    <ArrowLeft size={14} /> Voltar para Tarefas
                </button>
                <div className="text-right">
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Lista de <span className="text-indigo-500">Compras</span></h2>
                </div>
            </div>


            <div className="space-y-4">
                {itensPendentes.length > 0 ? (
                    itensPendentes.map((item) => {
                        const qtd = Number(item.quantidadeAtual);
                        const min = Number(item.minimoEsperado);

                        const limiteCritico = min + 1;

                        const isCritico = qtd <= limiteCritico;

                        const isAtencao = !isCritico && qtd <= (limiteCritico + 2);

                        const isSuave = !isCritico && !isAtencao;

                        const pulseClass = isCritico
                            ? "animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.15)] border-rose-500/40 bg-rose-500/5"
                            : isAtencao
                                ? "animate-pulse shadow-[0_0_15px_rgba(251,191,36,0.1)] border-amber-500/30 bg-amber-500/5"
                                : "border-emerald-500/20 bg-emerald-500/[0.02]";

                        const iconColor = isCritico ? "text-rose-500" : isAtencao ? "text-amber-500" : "text-emerald-400";

                        return (
                            <div key={item.id} className={`group border rounded-[2.5rem] p-7 flex items-center justify-between transition-all duration-500 ${pulseClass}`}>
                                <div className="flex items-center gap-6">
                                    <div className={`p-4 rounded-2xl bg-white/5 ${iconColor} transition-colors`}>
                                        <Package size={28} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em]">
                                                {item.categoria?.nome || "Insumo"}
                                            </p>
                                            {isCritico && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
                                        </div>
                                        <h4 className="text-lg font-black text-white uppercase italic tracking-tight leading-none">
                                            {item.nome}
                                        </h4>
                                    </div>
                                </div>

                                <div className="flex items-center gap-10">
                                    <div className="flex flex-col items-end">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Status de Estoque</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-white italic">
                                                {qtd}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                / {min} {item.unidade}
                                            </span>
                                        </div>

                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded mt-2 ${isCritico ? 'text-rose-500' : isAtencao ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            {isCritico ? "Crítico: Repor Agora" : isAtencao ? "Atenção: Limite Próximo" : "Estoque Seguro"}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => RemoverDaLista(item.produtoId).then(atualizarDados)}
                                            className="p-4 bg-white/5 text-slate-600 rounded-2xl hover:bg-rose-500 hover:text-white transition-all border border-white/5 cursor-pointer"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setItemSelecionado(item);
                                                setOperationKey(crypto.randomUUID());
                                            }}
                                            className="px-6 py-4 bg-white text-black rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-xl cursor-pointer font-black text-[10px] uppercase flex items-center gap-2"
                                        >
                                            <CheckCircle2 size={18} />
                                            Comprado
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[3.5rem]">
                        <ShoppingCart className="mx-auto text-slate-800 mb-6 opacity-20" size={56} />
                        <p className="text-[10px] font-black uppercase text-slate-600 tracking-[0.4em]">Carrinho de Compras Vazio</p>
                    </div>
                )}
            </div>
        </div>
    );
}
