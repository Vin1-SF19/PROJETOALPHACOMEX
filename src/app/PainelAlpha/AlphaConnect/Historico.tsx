"use client";

import { useState, useEffect } from "react";
import { fmtDateTime } from "@/lib/format-date";
import { X, Download, FileSpreadsheet, Clock, Trash2, Loader2 } from "lucide-react";
import { getHistoricoPlanilhas, baixarPlanilhaDoBanco, excluirPlanilhaBanco } from "@/actions/HistoricoPlanilhaFiscal";
import { saveAs } from "file-saver";
import { toast } from "sonner";

export function ModalHistorico({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [lista, setLista] = useState<any[]>([]);
    const [carregando, setCarregando] = useState(false);
    const [processandoId, setProcessandoId] = useState<number | null>(null);

    const carregarHistorico = async () => {
        setCarregando(true);
        const res = await getHistoricoPlanilhas();
        setLista(res);
        setCarregando(false);
    };

    useEffect(() => {
        if (isOpen) carregarHistorico();
    }, [isOpen]);

    const handleDownload = async (id: number) => {
        setProcessandoId(id);
        const res = await baixarPlanilhaDoBanco(id);
        if (res) {
            const blob = new Blob([Buffer.from(res.base64, 'base64')], { 
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
            });
            saveAs(blob, res.nome);
            toast.success("Download iniciado");
        }
        setProcessandoId(null);
    };

    const handleExcluir = async (id: number) => {
        if (!confirm("EXCLUIR ESTA PLANILHA PERMANENTEMENTE?")) return;
        
        const res = await excluirPlanilhaBanco(id);
        if (res.success) {
            toast.success("PLANILHA REMOVIDA");
            carregarHistorico();
        } else {
            toast.error("FALHA AO EXCLUIR");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="bg-[#0A0A0A] border border-white/10 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-black italic text-white uppercase tracking-tighter flex items-center gap-3">
                        <Clock size={20} className="text-emerald-500" /> Histórico de Exportações
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
                </div>

                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                    {carregando ? (
                        <div className="py-20 flex flex-col items-center gap-4">
                            <Loader2 className="animate-spin text-emerald-500" size={32} />
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Sincronizando Base...</p>
                        </div>
                    ) : lista.length > 0 ? lista.map((item) => (
                        <div key={item.id} className="bg-white/5 border border-white/5 p-5 rounded-2xl flex items-center justify-between group hover:border-white/10 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                                    <FileSpreadsheet size={20}/>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-white uppercase truncate max-w-[250px]">{item.nome}</p>
                                    <p className="text-[8px] font-bold text-slate-500 uppercase">
                                        {fmtDateTime(item.data)}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handleDownload(item.id)}
                                    disabled={processandoId === item.id}
                                    className="p-3 bg-white/5 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-50"
                                    title="Baixar"
                                >
                                    {processandoId === item.id ? <Loader2 className="animate-spin" size={18}/> : <Download size={18}/>}
                                </button>
                                
                                <button 
                                    onClick={() => handleExcluir(item.id)}
                                    className="p-3 bg-white/5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                    title="Excluir"
                                >
                                    <Trash2 size={18}/>
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="py-20 text-center">
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">O histórico está vazio.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
