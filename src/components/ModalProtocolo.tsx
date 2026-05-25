"use client";

import { useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "./ui/dialog";
import {
  FileText, AlertTriangle, CheckCircle, Copy, Check,
  Sparkles, ChevronDown, ChevronRight, Loader2, BookOpen,
  MessageCircle, Phone, PhoneOff,
} from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { finalizarComProtocolo, salvarWhatsAppLog } from "@/actions/protocolos";

type Template = {
  id: number;
  nome: string;
  categoria: string;
  template: string;
  ativo: boolean;
};

type Chamado = {
  id: number;
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: string;
  createdAt: Date | string;
  usuarioId?: number;
  solicitante: {
    nome: string;
    usuario: string;
    telefone?: string | null;
    telefone_corporativo?: string | null;
  };
};

type Props = {
  open: boolean;
  onClose: () => void;
  chamado: Chamado;
  templates: Template[];
};

const PLACEHOLDERS = [
  { tag: "[NOME]", desc: "Nome do solicitante" },
  { tag: "[PROTOCOLO]", desc: "Número do chamado" },
  { tag: "[SOLUCAO]", desc: "Solução aplicada" },
  { tag: "[CAUSA]", desc: "Causa do problema" },
  { tag: "[RESPONSAVEL]", desc: "Colaborador responsável" },
  { tag: "[DATA]", desc: "Data de conclusão" },
  { tag: "[CATEGORIA]", desc: "Categoria do chamado" },
];

function formatarTelefone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digitos = raw.replace(/\D/g, "");
  if (!digitos) return null;
  // Já tem DDI
  if (digitos.startsWith("55") && digitos.length >= 12) return digitos;
  // Número BR: 10-11 dígitos
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  // Número com DDI diferente: retorna como está
  if (digitos.length >= 12) return digitos;
  return null;
}

function substituirPlaceholders(
  template: string,
  chamado: Chamado,
  solucao: string,
  causa: string,
  responsavel: string
): string {
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  return template
    .replace(/\[NOME\]/g, chamado.solicitante.nome)
    .replace(/\[PROTOCOLO\]/g, `#${chamado.id}`)
    .replace(/\[SOLUCAO\]/g, solucao || "[SOLUCAO]")
    .replace(/\[CAUSA\]/g, causa || "[CAUSA]")
    .replace(/\[RESPONSAVEL\]/g, responsavel || "[RESPONSAVEL]")
    .replace(/\[DATA\]/g, dataHoje)
    .replace(/\[CATEGORIA\]/g, chamado.categoria);
}

export default function ModalProtocolo({ open, onClose, chamado, templates }: Props) {
  const [etapa, setEtapa] = useState<"formulario" | "preview">("formulario");
  const [solucao, setSolucao] = useState("");
  const [causa, setCausa] = useState("");
  const [templateSelecionado, setTemplateSelecionado] = useState<Template | null>(null);
  const [mensagemFinal, setMensagemFinal] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [mostrarOutros, setMostrarOutros] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [zapEnviado, setZapEnviado] = useState(false);

  const telefoneBruto = chamado.solicitante.telefone_corporativo || chamado.solicitante.telefone;
  const telefoneFormatado = formatarTelefone(telefoneBruto);
  const temTelefone = !!telefoneFormatado;

  const templatesDaCategoria = templates.filter(
    (t) => t.categoria === chamado.categoria || t.categoria === "GERAL"
  );
  const outrosTemplates = templates.filter(
    (t) => t.categoria !== chamado.categoria && t.categoria !== "GERAL"
  );

  const aplicarTemplate = (t: Template) => {
    setTemplateSelecionado(t);
    const gerada = substituirPlaceholders(t.template, chamado, solucao, causa, "");
    setMensagemFinal(gerada);
  };

  const gerarMensagemAutomatica = () => {
    const dataHoje = new Date().toLocaleDateString("pt-BR");
    const gerada =
      `Olá, ${chamado.solicitante.nome}.\n\n` +
      `Seu chamado #${chamado.id} foi concluído com sucesso ✅\n\n` +
      (causa ? `Identificamos que o problema estava relacionado a:\n${causa}\n\n` : "") +
      `A solução aplicada foi:\n${solucao || "[descreva a solução acima]"}\n\n` +
      `O sistema já foi atualizado e normalizado. Caso ainda encontre qualquer inconsistência, basta nos chamar.\n\n` +
      `Equipe Alpha Comex — ${dataHoje}`;
    setMensagemFinal(gerada);
    setTemplateSelecionado(null);
  };

  const handleCopiar = () => {
    navigator.clipboard.writeText(mensagemFinal).then(() => {
      setCopiado(true);
      toast.success("Mensagem copiada!");
      setTimeout(() => setCopiado(false), 2500);
    });
  };

  const handleWhatsApp = () => {
    if (!telefoneFormatado) {
      toast.error("Usuário não tem telefone cadastrado.");
      return;
    }
    if (!mensagemFinal.trim()) {
      toast.error("Gere a mensagem antes de enviar.");
      return;
    }

    const url = `https://wa.me/${telefoneFormatado}?text=${encodeURIComponent(mensagemFinal)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setZapEnviado(true);

    // Salvar log sem bloquear UX
    salvarWhatsAppLog({
      chamadoId: chamado.id,
      usuarioId: chamado.usuarioId ?? 0,
      telefone: telefoneFormatado,
      mensagem: mensagemFinal,
    }).catch(() => {/* log failure é não-crítico */});

    toast.success("WhatsApp aberto!");
  };

  const handleFinalizar = () => {
    if (!solucao.trim()) {
      toast.error("Descreva a solução antes de finalizar.");
      return;
    }
    startTransition(async () => {
      const res = await finalizarComProtocolo(chamado.id, {
        solucao,
        causa,
        mensagemFinal,
        templateId: templateSelecionado?.id,
      });
      if (res.success) {
        toast.success("Chamado finalizado com protocolo!");
        onClose();
      } else {
        toast.error(res.error || "Erro ao finalizar.");
      }
    });
  };

  const podeAvancar = solucao.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#060d1a] border-white/10 text-white max-w-3xl rounded-[2rem] p-0 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Linha decorativa topo */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

        {/* Header */}
        <div className="p-7 border-b border-white/5 bg-gradient-to-b from-emerald-500/5 to-transparent flex-shrink-0">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/15 rounded-2xl border border-emerald-500/20">
                  <FileText className="text-emerald-400 w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black uppercase tracking-tighter">
                    Finalizar com <span className="text-emerald-400">Protocolo</span>
                  </DialogTitle>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      #{chamado.id} • {chamado.solicitante.nome} • {chamado.categoria}
                    </p>
                    {/* Indicador de telefone */}
                    {temTelefone ? (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                        <Phone size={9} className="text-emerald-400" />
                        <span className="text-[8px] font-black text-emerald-400 uppercase">WhatsApp disponível</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-500/10 border border-slate-500/20">
                        <PhoneOff size={9} className="text-slate-500" />
                        <span className="text-[8px] font-black text-slate-500 uppercase">Sem telefone</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Stepper */}
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                <div className={`px-3 py-1 rounded-lg border transition-all ${etapa === "formulario" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-slate-500"}`}>
                  1 Solução
                </div>
                <ChevronRight size={12} className="text-slate-700" />
                <div className={`px-3 py-1 rounded-lg border transition-all ${etapa === "preview" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-slate-500"}`}>
                  2 Protocolo
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {etapa === "formulario" ? (
            <div className="p-7 space-y-6">

              {/* Resumo do chamado */}
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-2">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ocorrência Relatada</p>
                <p className="text-sm text-slate-300 leading-relaxed">{chamado.descricao}</p>
              </div>

              {/* Causa raiz */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle size={12} className="text-amber-400" />
                  Causa do Problema <span className="text-slate-600 normal-case font-bold">(opcional)</span>
                </label>
                <textarea
                  value={causa}
                  onChange={(e) => setCausa(e.target.value)}
                  rows={2}
                  placeholder="Ex: Divergência cadastral entre Receita e sistema interno..."
                  className="w-full rounded-2xl border border-white/5 bg-black/40 p-4 text-sm text-white font-medium focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/5 transition-all resize-none placeholder:text-slate-700"
                />
              </div>

              {/* Solução aplicada */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle size={12} className="text-emerald-400" />
                  Solução Aplicada <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={solucao}
                  onChange={(e) => setSolucao(e.target.value)}
                  rows={4}
                  placeholder="Descreva detalhadamente o que foi feito para resolver o problema..."
                  className="w-full rounded-2xl border border-white/5 bg-black/40 p-4 text-sm text-white font-medium focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/5 transition-all resize-none placeholder:text-slate-700"
                />
                <p className={`text-[10px] font-bold text-right tabular-nums ${solucao.length < 10 ? "text-slate-700" : "text-emerald-500"}`}>
                  {solucao.length} caracteres {solucao.length < 10 && solucao.length > 0 ? `(mín. 10)` : ""}
                </p>
              </div>

              {/* Templates sugeridos */}
              {templatesDaCategoria.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles size={12} className="text-violet-400" />
                    Templates Sugeridos para &quot;{chamado.categoria}&quot;
                  </p>
                  <div className="grid gap-2">
                    {templatesDaCategoria.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => aplicarTemplate(t)}
                        className={`text-left p-4 rounded-2xl border transition-all ${templateSelecionado?.id === t.id ? "bg-violet-500/10 border-violet-500/40" : "bg-white/3 border-white/5 hover:border-white/15"}`}
                      >
                        <p className="text-sm font-black text-white">{t.nome}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5 line-clamp-2">{t.template.slice(0, 80)}…</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Outros templates */}
              {outrosTemplates.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setMostrarOutros(!mostrarOutros)}
                    className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors"
                  >
                    {mostrarOutros ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Outros templates ({outrosTemplates.length})
                  </button>
                  {mostrarOutros && (
                    <div className="grid gap-2 mt-2">
                      {outrosTemplates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => aplicarTemplate(t)}
                          className={`text-left p-4 rounded-2xl border transition-all ${templateSelecionado?.id === t.id ? "bg-violet-500/10 border-violet-500/40" : "bg-white/3 border-white/5 hover:border-white/15"}`}
                        >
                          <p className="text-xs font-black text-white">{t.nome}</p>
                          <p className="text-[9px] text-slate-500 font-bold mt-0.5">{t.categoria}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-7 space-y-6">

              {/* Telefone do solicitante */}
              <div className={`flex items-center gap-3 p-4 rounded-2xl border ${temTelefone ? "bg-emerald-500/5 border-emerald-500/20" : "bg-slate-900/30 border-white/5"}`}>
                {temTelefone ? (
                  <>
                    <Phone size={16} className="text-emerald-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Telefone do solicitante</p>
                      <p className="text-sm font-bold text-white font-mono">
                        {telefoneBruto}
                        <span className="text-slate-500 text-[10px] ml-2 font-normal">(formatado: +{telefoneFormatado})</span>
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <PhoneOff size={16} className="text-slate-500 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sem telefone cadastrado</p>
                      <p className="text-[10px] text-slate-600 font-bold">O usuário não tem telefone no perfil. Configure em Gestão de Colaboradores.</p>
                    </div>
                  </>
                )}
              </div>

              {/* Preview da mensagem */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <BookOpen size={12} className="text-blue-400" />
                    Mensagem para WhatsApp
                    {templateSelecionado && (
                      <span className="text-[9px] text-violet-400 font-bold normal-case">
                        (template: {templateSelecionado.nome})
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={gerarMensagemAutomatica}
                      className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white h-7 px-3 rounded-lg"
                    >
                      <Sparkles size={10} className="mr-1" />
                      Gerar automático
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopiar}
                      className={`text-[9px] font-black uppercase tracking-widest h-7 px-3 rounded-lg transition-all ${copiado ? "text-emerald-400" : "text-blue-400 hover:text-white"}`}
                    >
                      {copiado ? <Check size={12} className="mr-1" /> : <Copy size={12} className="mr-1" />}
                      {copiado ? "Copiado!" : "Copiar"}
                    </Button>
                  </div>
                </div>
                <textarea
                  value={mensagemFinal}
                  onChange={(e) => setMensagemFinal(e.target.value)}
                  rows={10}
                  placeholder="A mensagem será gerada automaticamente. Você pode editar antes de copiar..."
                  className="w-full rounded-2xl border border-white/5 bg-black/40 p-4 text-sm text-slate-200 font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/5 transition-all resize-none placeholder:text-slate-700 leading-relaxed"
                />
                <p className="text-[9px] text-slate-600 font-bold">
                  💡 Edite livremente. Edições não afetam a solução técnica salva.
                </p>
              </div>

              {/* Placeholders */}
              <div className="p-4 rounded-2xl bg-slate-900/30 border border-white/5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Inserir placeholder</p>
                <div className="flex flex-wrap gap-2">
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p.tag}
                      type="button"
                      onClick={() => setMensagemFinal((prev) => prev + p.tag)}
                      title={p.desc}
                      className="px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[9px] font-black hover:bg-violet-500/20 transition-all"
                    >
                      {p.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resumo */}
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">O que será salvo:</p>
                <div className="space-y-1 text-[10px]">
                  <div>
                    <span className="text-slate-500 font-bold">Solução:</span>
                    <span className="text-slate-300 ml-1">{solucao.slice(0, 80)}{solucao.length > 80 ? "…" : ""}</span>
                  </div>
                  {causa && (
                    <div>
                      <span className="text-slate-500 font-bold">Causa:</span>
                      <span className="text-slate-300 ml-1">{causa.slice(0, 80)}{causa.length > 80 ? "…" : ""}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-slate-950/40 flex-shrink-0">
          {etapa === "formulario" ? (
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={onClose} className="font-bold rounded-xl border border-white/10 hover:border-white/20 text-slate-400 hover:text-white h-11 px-5">
                Cancelar
              </Button>
              <Button
                onClick={gerarMensagemAutomatica}
                disabled={!podeAvancar}
                className="bg-slate-800 hover:bg-slate-700 text-white h-11 px-5 font-black rounded-xl border border-white/10 disabled:opacity-40"
              >
                <Sparkles size={14} className="mr-2" />
                Gerar mensagem
              </Button>
              <Button
                onClick={() => {
                  if (!podeAvancar) return;
                  if (!mensagemFinal) gerarMensagemAutomatica();
                  setEtapa("preview");
                }}
                disabled={!podeAvancar}
                className="bg-emerald-600 hover:bg-emerald-500 text-white h-11 px-5 font-black rounded-xl shadow-lg shadow-emerald-900/20 disabled:opacity-40"
              >
                Próximo
                <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-3 justify-between">
              <Button
                variant="ghost"
                onClick={() => setEtapa("formulario")}
                className="font-bold rounded-xl border border-white/10 hover:border-white/20 text-slate-400 hover:text-white h-11 px-5"
              >
                Voltar
              </Button>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  onClick={handleCopiar}
                  className={`h-11 px-4 font-black rounded-xl border transition-all text-sm ${copiado ? "bg-emerald-600 text-white" : "bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white"}`}
                >
                  {copiado ? <Check size={14} className="mr-1.5" /> : <Copy size={14} className="mr-1.5" />}
                  {copiado ? "Copiado!" : "Copiar"}
                </Button>
                {/* Botão WhatsApp */}
                <Button
                  type="button"
                  onClick={handleWhatsApp}
                  disabled={!temTelefone}
                  className={`h-11 px-4 font-black rounded-xl border transition-all text-sm ${
                    !temTelefone
                      ? "bg-slate-800/50 border-slate-700/30 text-slate-600 cursor-not-allowed"
                      : zapEnviado
                      ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white"
                      : "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20"
                  }`}
                  title={!temTelefone ? "Usuário sem telefone cadastrado" : "Abrir WhatsApp Web"}
                >
                  <MessageCircle size={14} className="mr-1.5" />
                  {zapEnviado ? "Enviado ✓" : "WhatsApp"}
                </Button>
                <Button
                  onClick={handleFinalizar}
                  disabled={isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white h-11 px-4 font-black rounded-xl shadow-lg shadow-emerald-900/20 disabled:opacity-40 text-sm"
                >
                  {isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <CheckCircle size={14} className="mr-1.5" />}
                  {isPending ? "Finalizando..." : "Finalizar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
