'use client';
import { createPerguntaAction, deletePerguntaAction, updatePerguntaAction } from "@/actions/questoes";
import { useState } from "react";
import { toast } from "sonner";
import { 
  ChevronLeft, 
  ListChecks, 
  AlignLeft, 
  Plus, 
  Trash2, 
  Edit2, 
  HelpCircle, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import type { getTagsAction } from "@/actions/questoes";
import type { TemaAlpha } from "@/lib/temas";

type TagQuestao = Awaited<ReturnType<typeof getTagsAction>>[number];
type Pergunta = TagQuestao['perguntas'][number];

export default function FormularioPerguntas({ temaConfig, tagAtiva, onVoltar }: {
    temaConfig: TemaAlpha;
    tagAtiva: TagQuestao;
    onVoltar: () => void;
    refresh?: () => Promise<void>;
}) {
    const router = useRouter();
    const [tipo, setTipo] = useState<'OBJETIVA' | 'DESCRITIVA'>('OBJETIVA');
    const [enunciado, setEnunciado] = useState("");
    const [opcoes, setOpcoes] = useState(["", "", "", ""]);
    const [correta, setCorreta] = useState(0);
    const [loading, setLoading] = useState(false);
    
    const [editandoId, setEditandoId] = useState<string | null>(null);

    const letras = ["A", "B", "C", "D"];
    
    // LIMITADOR: 20 questões por tag
    const totalQuestoes = tagAtiva.perguntas?.length || 0;
    const limiteAtingido = totalQuestoes >= 20;

    const handlePrepararEdicao = (p: Pergunta) => {
        setEditandoId(p.id);
        setTipo(p.tipo as 'OBJETIVA' | 'DESCRITIVA');
        setEnunciado(p.enunciado);
        
        if (p.tipo === 'OBJETIVA') {
            try {
                const ops = JSON.parse(p.opcoes);
                setOpcoes(ops);
                const indexCorreto = letras.indexOf(p.respostaCorreta);
                setCorreta(indexCorreto !== -1 ? indexCorreto : 0);
            } catch (e) {
                setOpcoes(["", "", "", ""]);
            }
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelarEdicao = () => {
        setEditandoId(null);
        setEnunciado("");
        setOpcoes(["", "", "", ""]);
        setCorreta(0);
        setTipo('OBJETIVA');
    };

    const handleSalvar = async () => {
        if (!editandoId && limiteAtingido) {
            return toast.error("Limite de 20 questões atingido para esta categoria.");
        }

        if (!enunciado) return toast.error("O enunciado é obrigatório");
        if (tipo === 'OBJETIVA' && opcoes.some(opt => !opt)) return toast.error("Preencha todas as opções");
        
        setLoading(true);
        const respostaFormatada = tipo === 'OBJETIVA' ? letras[correta] : "";

        try {
            const payload = {
                enunciado,
                tipo,
                opcoes: tipo === 'OBJETIVA' ? opcoes : [],
                respostaCorreta: respostaFormatada, 
                tagId: tagAtiva.id
            };

            const res = editandoId
                ? await updatePerguntaAction({ ...payload, id: editandoId })
                : await createPerguntaAction(payload);

            if (res.success) {
                toast.success(editandoId ? "Edição salva!" : "Pergunta vinculada!");
                cancelarEdicao();
                router.refresh();
            } else {
                toast.error("Erro ao processar solicitação");
            }
        } catch (error) {
            toast.error("Erro de conexão");
        } finally {
            setLoading(false);
        }
    };

    const handleDeletar = async (id: string) => {
        if (!confirm("Excluir permanentemente?")) return;
        const res = await deletePerguntaAction(id);
        if (res.success) {
            toast.success("Removida");
            router.refresh();
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-6 duration-500">
            <div className="flex items-center justify-between">
                <button 
                    onClick={onVoltar}
                    className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-all group"
                >
                    <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10 border border-white/5">
                        <ChevronLeft size={16} />
                    </div>
                    Voltar para categorias
                </button>
                <div className="text-right">
                    <h2 className="text-sm font-black uppercase italic text-white tracking-tighter">
                        Gerenciador Alpha
                    </h2>
                    <p className={`text-[9px] font-bold uppercase ${temaConfig.text} tracking-[0.2em]`}>
                        Tag: {tagAtiva.nome}
                    </p>
                </div>
            </div>

            <div className={`bg-white/[0.02] border transition-all duration-500 rounded-[2.5rem] p-8 relative overflow-hidden ${editandoId ? 'border-orange-500/40 bg-orange-500/[0.03]' : 'border-white/5'}`}>
                
                {/* AVISO DE LIMITE */}
                {!editandoId && limiteAtingido && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-12 text-center">
                        <Lock className="text-orange-500 mb-4" size={40} />
                        <h3 className="text-xl font-black uppercase italic text-white">Capacidade Máxima</h3>
                        <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-2 max-w-xs">
                            Esta categoria já atingiu o limite de 20 questões. Remova algum item para adicionar novos.
                        </p>
                    </div>
                )}

                <div className="max-w-2xl mx-auto space-y-6 relative z-10">
                    {editandoId && (
                        <div className="flex items-center justify-between p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <Edit2 size={14} className="text-orange-500" />
                                <span className="text-[10px] font-black uppercase text-orange-500">Editando Questão</span>
                            </div>
                            <button onClick={cancelarEdicao} className="text-orange-500"><X size={16} /></button>
                        </div>
                    )}

                    <div className="flex gap-2 p-1.5 bg-black/40 border border-white/5 rounded-2xl w-fit">
                        <button onClick={() => setTipo('OBJETIVA')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${tipo === 'OBJETIVA' ? temaConfig.bg + ' text-white' : 'text-slate-500'}`}>Objetiva</button>
                        <button onClick={() => setTipo('DESCRITIVA')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${tipo === 'DESCRITIVA' ? temaConfig.bg + ' text-white' : 'text-slate-500'}`}>Descritiva</button>
                    </div>

                    <div className="space-y-3">
                        <textarea 
                            value={enunciado}
                            onChange={(e) => setEnunciado(e.target.value)}
                            className="w-full bg-black/60 border border-white/5 rounded-3xl p-5 text-xs text-white min-h-[120px] outline-none focus:border-orange-500/40"
                            placeholder="Digite a pergunta..."
                        />
                    </div>

                    {tipo === 'OBJETIVA' && (
                        <div className="grid grid-cols-1 gap-2">
                            {opcoes.map((opt, i) => (
                                <div key={i} className="flex gap-2">
                                    <button onClick={() => setCorreta(i)} className={`w-12 h-12 rounded-xl border-2 font-black ${correta === i ? 'bg-orange-500 border-orange-400 text-white' : 'bg-black/40 border-white/5 text-slate-600'}`}>{letras[i]}</button>
                                    <input value={opt} onChange={(e) => { const n = [...opcoes]; n[i] = e.target.value; setOpcoes(n); }} className="flex-1 bg-black/40 border border-white/5 rounded-xl px-5 text-xs text-white" />
                                </div>
                            ))}
                        </div>
                    )}

                    <button 
                        onClick={handleSalvar}
                        disabled={loading || (!editandoId && limiteAtingido)}
                        className={`w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] text-white shadow-2xl transition-all flex items-center justify-center gap-3 ${editandoId ? 'bg-orange-600' : temaConfig.bg} disabled:opacity-30`}
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : editandoId ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                        {editandoId ? "Salvar Alterações" : "Adicionar Questão"}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between px-6">
                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Questões Disponíveis</h4>
                    <div className={`px-4 py-1.5 rounded-full border text-[10px] font-black uppercase flex items-center gap-2 ${limiteAtingido ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-white/5 border-white/5 text-slate-400'}`}>
                        {totalQuestoes} / 20 {limiteAtingido && <AlertCircle size={12} />}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2 px-2">
                    {tagAtiva.perguntas?.map((p) => (
                        <div key={p.id} className={`group p-5 border rounded-[1.5rem] flex items-center justify-between transition-all ${editandoId === p.id ? 'bg-orange-500/10 border-orange-500/40' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'}`}>
                            <div className="flex-1 min-w-0 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-white/5 border-white/5 text-slate-400">
                                    {p.tipo === 'OBJETIVA' ? <ListChecks size={18} /> : <AlignLeft size={18} />}
                                </div>
                                <div className="truncate">
                                    <p className="text-[10px] font-black text-white uppercase truncate">{p.enunciado}</p>
                                    <span className="text-[8px] font-black text-slate-500 uppercase">{p.tipo}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handlePrepararEdicao(p)} className={`p-2.5 rounded-xl ${editandoId === p.id ? 'bg-orange-500 text-white' : 'bg-white/5 text-slate-500'}`}><Edit2 size={14} /></button>
                                <button onClick={() => handleDeletar(p.id)} className="p-2.5 bg-red-500/5 text-red-500/40 hover:text-red-500"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
