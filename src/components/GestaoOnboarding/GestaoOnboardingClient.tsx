"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Check, X, Eye, Star, StarOff,
  MessageSquare, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  criarTemplateOnboarding,
  atualizarTemplateOnboarding,
  excluirTemplateOnboarding,
  type OnboardingTemplate,
} from "@/actions/onboarding";

const SETORES_OPCOES = ["Geral", "Comercial", "Financeiro", "Recursos Humanos", "TI", "Operacional", "Outro"];

const DEFAULT_MENSAGEM = `🎉 Seja muito bem-vindo ao Painel Alpha!

Aqui centralizamos os principais softwares internos da Alpha Comex & Compliance para facilitar o acesso e a utilização no dia a dia. 💻⚙️

🔗 Link de acesso:
https://painel-alpha-projeto.vercel.app/

👤 Seu login:
[LOGIN]

🔑 Sua senha:
[SENHA]

⚠️ Importante:
O sistema ainda está em fase de testes. Caso encontre algum bug ou comportamento inesperado, pedimos que informe ao time de TI através da Central de Chamados.`;

type FormState = {
  nome: string;
  setor: string;
  mensagem: string;
  ativo: boolean;
  padrao: boolean;
};

function FormularioTemplate({
  inicial,
  onSalvar,
  onCancelar,
  salvando,
}: {
  inicial: FormState;
  onSalvar: (dados: FormState) => void;
  onCancelar: () => void;
  salvando: boolean;
}) {
  const [form, setForm] = useState<FormState>(inicial);
  const [expandido, setExpandido] = useState(true);

  const inserirPlaceholder = (ph: string) => {
    setForm((f) => ({ ...f, mensagem: f.mensagem + ph }));
  };

  return (
    <div className="border border-indigo-500/20 rounded-2xl overflow-hidden bg-indigo-500/3">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors"
      >
        <MessageSquare size={14} className="text-indigo-400" />
        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex-1 text-left">
          {form.nome || "Novo Template"}
        </span>
        {expandido ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>

      {expandido && (
        <div className="p-4 border-t border-indigo-500/10 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nome do Template</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Boas-vindas Padrão"
                className="h-10 bg-black/40 border-white/5 rounded-xl text-sm focus:border-indigo-500/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Setor (opcional)</Label>
              <Select value={form.setor} onValueChange={(v) => setForm((f) => ({ ...f, setor: v }))}>
                <SelectTrigger className="h-10 bg-black/40 border-white/5 rounded-xl text-sm focus:border-indigo-500/40">
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-white/10 text-white rounded-xl">
                  <SelectItem value="__todos__" className="text-xs focus:bg-indigo-600">Todos os setores</SelectItem>
                  {SETORES_OPCOES.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs focus:bg-indigo-600">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Mensagem</Label>
              <div className="flex flex-wrap gap-1">
                {["[NOME]", "[LOGIN]", "[SENHA]", "[EMAIL]", "[SETOR]", "[LINK]"].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => inserirPlaceholder(ph)}
                    className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[7px] font-black hover:bg-indigo-500/20 transition-colors"
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={form.mensagem}
              onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))}
              rows={8}
              placeholder="Escreva a mensagem de boas-vindas..."
              className="w-full rounded-xl border border-white/5 bg-black/40 p-3 text-sm text-slate-300 leading-relaxed focus:outline-none focus:border-indigo-500/40 transition-all resize-none font-mono"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                className="rounded"
              />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ativo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.padrao}
                onChange={(e) => setForm((f) => ({ ...f, padrao: e.target.checked }))}
                className="rounded"
              />
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">Padrão</span>
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={onCancelar}
              variant="ghost"
              className="cursor-pointer flex-1 h-10 font-bold rounded-xl border border-white/10 text-slate-400 hover:text-white"
            >
              <X size={14} className="mr-1" />Cancelar
            </Button>
            <Button
              onClick={() => onSalvar(form)}
              disabled={salvando || !form.nome.trim() || !form.mensagem.trim()}
              className="cursor-pointer flex-1 h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl disabled:opacity-40"
            >
              {salvando ? "Salvando..." : <><Check size={14} className="mr-1" />Salvar</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GestaoOnboardingClient({ templates: initialTemplates }: { templates: OnboardingTemplate[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState(initialTemplates);
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const reload = () => router.refresh();

  const handleCriar = (dados: FormState) => {
    startTransition(async () => {
      const res = await criarTemplateOnboarding({
        nome: dados.nome,
        setor: dados.setor && dados.setor !== "__todos__" ? dados.setor : undefined,
        mensagem: dados.mensagem,
        padrao: dados.padrao,
      });
      if (res.success) {
        toast.success("Template criado!");
        setCriando(false);
        reload();
      } else {
        toast.error(res.error ?? "Erro ao criar");
      }
    });
  };

  const handleAtualizar = (id: number, dados: FormState) => {
    startTransition(async () => {
      const res = await atualizarTemplateOnboarding(id, {
        nome: dados.nome,
        setor: dados.setor && dados.setor !== "__todos__" ? dados.setor : undefined,
        mensagem: dados.mensagem,
        ativo: dados.ativo,
        padrao: dados.padrao,
      });
      if (res.success) {
        toast.success("Template atualizado!");
        setEditandoId(null);
        reload();
      } else {
        toast.error(res.error ?? "Erro ao atualizar");
      }
    });
  };

  const handleExcluir = (id: number) => {
    startTransition(async () => {
      const res = await excluirTemplateOnboarding(id);
      if (res.success) {
        toast.success("Template removido");
        setExcluindoId(null);
        reload();
      } else {
        toast.error(res.error ?? "Erro ao excluir");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Botão criar */}
      {!criando && (
        <Button
          onClick={() => setCriando(true)}
          className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl h-11 px-5 shadow-lg shadow-indigo-900/20"
        >
          <Plus size={15} className="mr-2" />
          Novo Template
        </Button>
      )}

      {/* Formulário criar */}
      {criando && (
        <FormularioTemplate
          inicial={{ nome: "", setor: "__todos__", mensagem: DEFAULT_MENSAGEM, ativo: true, padrao: false }}
          onSalvar={handleCriar}
          onCancelar={() => setCriando(false)}
          salvando={isPending}
        />
      )}

      {/* Lista de templates */}
      <div className="space-y-3">
        {templates.length === 0 && !criando && (
          <div className="text-center py-16 text-slate-600">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-bold">Nenhum template cadastrado</p>
            <p className="text-[11px] mt-1">Crie o primeiro template de onboarding</p>
          </div>
        )}

        {templates.map((t) => {
          if (editandoId === t.id) {
            return (
              <FormularioTemplate
                key={t.id}
                inicial={{ nome: t.nome, setor: t.setor ?? "__todos__", mensagem: t.mensagem, ativo: t.ativo, padrao: t.padrao }}
                onSalvar={(dados) => handleAtualizar(t.id, dados)}
                onCancelar={() => setEditandoId(null)}
                salvando={isPending}
              />
            );
          }

          return (
            <div key={t.id} className="rounded-2xl bg-white/3 border border-white/5 overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-white text-sm">{t.nome}</h3>
                    {t.padrao && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black uppercase">
                        Padrão
                      </span>
                    )}
                    {!t.ativo && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-700/50 border border-slate-600/20 text-slate-500 text-[8px] font-black uppercase">
                        Inativo
                      </span>
                    )}
                    {t.setor && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[8px] font-black">
                        {t.setor}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-600 mt-0.5 truncate">{t.mensagem.slice(0, 80)}...</p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewId(previewId === t.id ? null : t.id)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title="Preview"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoId(t.id)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-blue-400 transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  {excluindoId === t.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleExcluir(t.id)}
                        disabled={isPending}
                        className="p-2 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-colors"
                        title="Confirmar exclusão"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setExcluindoId(null)}
                        className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setExcluindoId(t.id)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {previewId === t.id && (
                <div className="border-t border-white/5 p-4">
                  <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2">Preview</p>
                  <pre className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono bg-black/30 rounded-xl p-3">
                    {t.mensagem}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
