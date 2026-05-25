"use client";

import { useState, useTransition } from "react";
import {
  Plus, Trash2, Edit2, Check, X, FileText, Tag,
  Loader2, BookOpen, Info, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { criarTemplate, atualizarTemplate, excluirTemplate } from "@/actions/protocolos";
import { useRouter } from "next/navigation";

type Template = {
  id: number;
  nome: string;
  categoria: string;
  template: string;
  ativo: boolean;
  createdAt: Date;
};

const CATEGORIAS_CHAMADO = [
  "GERAL", "Hardware", "Software", "Rede", "Acesso", "Financeiro", "Outro",
];

const PLACEHOLDERS_INFO = [
  "[NOME]", "[PROTOCOLO]", "[SOLUCAO]", "[CAUSA]", "[RESPONSAVEL]", "[DATA]", "[CATEGORIA]",
];

type Props = {
  templates: Template[];
};

export default function GestaoProtocolosClient({ templates: inicial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState<Template[]>(inicial);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);
  const [preview, setPreview] = useState<Template | null>(null);

  const [form, setForm] = useState({ nome: "", categoria: "GERAL", template: "" });

  const reset = () => {
    setForm({ nome: "", categoria: "GERAL", template: "" });
    setCriando(false);
    setEditandoId(null);
  };

  const handleCriar = () => {
    if (!form.nome.trim() || !form.template.trim()) {
      toast.error("Nome e template são obrigatórios.");
      return;
    }
    startTransition(async () => {
      const res = await criarTemplate(form);
      if (res.success) {
        toast.success("Template criado!");
        reset();
        router.refresh();
      } else {
        toast.error(res.error || "Erro ao criar.");
      }
    });
  };

  const handleEditar = (t: Template) => {
    setEditandoId(t.id);
    setForm({ nome: t.nome, categoria: t.categoria, template: t.template });
    setCriando(false);
  };

  const handleSalvarEdicao = (id: number, ativo: boolean) => {
    if (!form.nome.trim() || !form.template.trim()) {
      toast.error("Nome e template são obrigatórios.");
      return;
    }
    startTransition(async () => {
      const res = await atualizarTemplate(id, { ...form, ativo });
      if (res.success) {
        toast.success("Template atualizado!");
        reset();
        router.refresh();
      } else {
        toast.error(res.error || "Erro ao atualizar.");
      }
    });
  };

  const handleExcluir = (id: number, nome: string) => {
    if (!confirm(`Excluir template "${nome}"?`)) return;
    startTransition(async () => {
      const res = await excluirTemplate(id);
      if (res.success) {
        toast.success("Template excluído.");
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        router.refresh();
      } else {
        toast.error(res.error || "Erro ao excluir.");
      }
    });
  };

  const porCategoria = CATEGORIAS_CHAMADO.reduce((acc, cat) => {
    acc[cat] = templates.filter((t) => t.categoria === cat);
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <div className="space-y-8">

      {/* Placeholders info */}
      <div className="p-5 rounded-[2rem] bg-violet-500/5 border border-violet-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Info size={14} className="text-violet-400" />
          <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Placeholders disponíveis</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PLACEHOLDERS_INFO.map((p) => (
            <span key={p} className="px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-black">
              {p}
            </span>
          ))}
        </div>
        <p className="text-[9px] text-slate-600 font-bold mt-3">
          Use esses placeholders no corpo do template. Serão substituídos automaticamente ao gerar o protocolo do chamado.
        </p>
      </div>

      {/* Formulário criar */}
      {!criando && !editandoId ? (
        <Button
          onClick={() => { setCriando(true); setForm({ nome: "", categoria: "GERAL", template: "" }); }}
          className="w-full bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-[1.5rem] h-12 font-black uppercase tracking-widest transition-all"
        >
          <Plus size={16} className="mr-2" />
          Novo Template de Protocolo
        </Button>
      ) : criando ? (
        <FormularioTemplate
          form={form}
          setForm={setForm}
          titulo="Novo Template"
          isPending={isPending}
          onSalvar={handleCriar}
          onCancelar={reset}
        />
      ) : null}

      {/* Templates por categoria */}
      {CATEGORIAS_CHAMADO.filter((cat) => porCategoria[cat]?.length > 0 || cat === "GERAL").map((cat) => {
        const lista = porCategoria[cat] ?? [];
        if (lista.length === 0) return null;

        return (
          <div key={cat} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-1 h-5 bg-violet-500 rounded-full" />
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                {cat} <span className="text-slate-600 font-bold">({lista.length})</span>
              </h3>
            </div>

            <div className="grid gap-3">
              {lista.map((t) => (
                <div key={t.id}>
                  {editandoId === t.id ? (
                    <FormularioTemplate
                      form={form}
                      setForm={setForm}
                      titulo={`Editando: ${t.nome}`}
                      isPending={isPending}
                      onSalvar={() => handleSalvarEdicao(t.id, t.ativo)}
                      onCancelar={reset}
                    />
                  ) : (
                    <div className={`group p-5 rounded-[2rem] border transition-all ${t.ativo ? "bg-slate-900/30 border-white/5 hover:border-white/10" : "bg-slate-900/10 border-white/3 opacity-50"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-black text-white">{t.nome}</span>
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase border ${t.ativo ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-slate-500/10 border-slate-500/20 text-slate-500"}`}>
                              {t.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold line-clamp-2 leading-relaxed">
                            {t.template.slice(0, 120)}{t.template.length > 120 ? "…" : ""}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => setPreview(t)}
                            className="p-2 rounded-lg hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 transition-colors"
                            title="Visualizar"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleEditar(t)}
                            className="p-2 rounded-lg hover:bg-amber-500/10 text-slate-500 hover:text-amber-400 transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleExcluir(t.id, t.nome)}
                            disabled={isPending}
                            className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-40"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {templates.length === 0 && !criando && (
        <div className="py-24 flex flex-col items-center text-center space-y-4 opacity-20">
          <BookOpen size={48} />
          <p className="text-[10px] font-black uppercase tracking-[0.5em]">Nenhum template cadastrado</p>
          <p className="text-xs text-slate-600">Crie o primeiro template para começar a gerar protocolos.</p>
        </div>
      )}

      {/* Modal preview */}
      {preview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setPreview(null)}>
          <div className="bg-[#060d1a] border border-white/10 rounded-[2rem] p-8 max-w-lg w-full relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreview(null)} className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white">
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <FileText size={16} className="text-violet-400" />
              <p className="font-black text-white">{preview.nome}</p>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Tag size={11} className="text-slate-500" />
              <p className="text-[10px] text-slate-500 font-bold uppercase">{preview.categoria}</p>
            </div>
            <pre className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-sans bg-black/30 p-4 rounded-2xl border border-white/5">
              {preview.template}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function FormularioTemplate({
  form,
  setForm,
  titulo,
  isPending,
  onSalvar,
  onCancelar,
}: {
  form: { nome: string; categoria: string; template: string };
  setForm: (f: { nome: string; categoria: string; template: string }) => void;
  titulo: string;
  isPending: boolean;
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="p-6 rounded-[2rem] bg-slate-900/40 border border-emerald-500/20 space-y-4">
      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{titulo}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nome do Template</label>
          <input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: Resolução Radar Siscomex"
            className="w-full rounded-xl border border-white/5 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-emerald-500/50 transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Categoria</label>
          <select
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            className="w-full rounded-xl border border-white/5 bg-black/40 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
          >
            {["GERAL", "Hardware", "Software", "Rede", "Acesso", "Financeiro", "Outro"].map((c) => (
              <option key={c} value={c} className="bg-slate-900">{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Corpo do Template</label>
        <textarea
          value={form.template}
          onChange={(e) => setForm({ ...form, template: e.target.value })}
          rows={7}
          placeholder={`Olá, [NOME].\n\nSeu chamado [PROTOCOLO] foi concluído com sucesso ✅\n\nIdentificamos que o problema estava relacionado a:\n[CAUSA]\n\nA solução aplicada foi:\n[SOLUCAO]\n\nEquipe Alpha Comex — [DATA]`}
          className="w-full rounded-2xl border border-white/5 bg-black/40 p-4 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-emerald-500/50 transition-all resize-none font-mono"
        />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="ghost" onClick={onCancelar} className="h-10 px-5 font-bold rounded-xl border border-white/10 text-slate-400 hover:text-white">
          <X size={14} className="mr-1" />
          Cancelar
        </Button>
        <Button
          onClick={onSalvar}
          disabled={isPending || !form.nome.trim() || !form.template.trim()}
          className="h-10 px-5 font-black rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 disabled:opacity-40"
        >
          {isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Check size={14} className="mr-1" />}
          Salvar Template
        </Button>
      </div>
    </div>
  );
}
