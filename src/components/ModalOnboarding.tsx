"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import {
  User, Mail, Copy, Check, MessageCircle, Phone,
  Key, Lock, Sparkles, X, Send, QrCode, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { salvarOnboardingLog, enviarEmailOnboarding } from "@/actions/onboarding";

const PANEL_URL = "https://painel-alpha-projeto.vercel.app/";

const DEFAULT_MENSAGEM = `🎉 Seja muito bem-vindo ao Painel Alpha!

Aqui centralizamos os principais softwares internos da Alpha Comex & Compliance para facilitar o acesso e a utilização no dia a dia. 💻⚙️

🔗 Link de acesso:
${PANEL_URL}

👤 Seu login:
[LOGIN]

🔑 Sua senha:
[SENHA]

⚠️ Importante:
O sistema ainda está em fase de testes. Caso encontre algum bug ou comportamento inesperado, pedimos que informe ao time de TI através da Central de Chamados.`;

export type OnboardingTemplate = {
  id: number;
  nome: string;
  setor: string | null;
  mensagem: string;
  ativo: boolean;
  padrao: boolean;
};

export type NovoUsuario = {
  id: number;
  nome: string;
  usuario: string;
  email: string;
  role: string;
  telefone?: string | null;
  telefone_corporativo?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  usuario: NovoUsuario | null;
  senhaTemporaria: string;
  templates?: OnboardingTemplate[];
};

function substituirPlaceholders(texto: string, u: NovoUsuario, senha: string): string {
  return texto
    .replace(/\[NOME\]/g, u.nome)
    .replace(/\[LOGIN\]/g, u.email)
    .replace(/\[SENHA\]/g, senha)
    .replace(/\[EMAIL\]/g, u.email)
    .replace(/\[SETOR\]/g, u.role)
    .replace(/\[CARGO\]/g, u.role)
    .replace(/\[LINK\]/g, PANEL_URL);
}

function formatarTelefone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length >= 12) return d;
  return null;
}

export default function ModalOnboarding({ open, onClose, usuario, senhaTemporaria, templates = [] }: Props) {
  const [templateAtualId, setTemplateAtualId] = useState<number | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [copiadoMsg, setCopiadoMsg] = useState(false);
  const [copiadoLogin, setCopiadoLogin] = useState(false);
  const [copiadoSenha, setCopiadoSenha] = useState(false);
  const [zapEnviado, setZapEnviado] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const templatePadrao = templates.find((t) => t.padrao) ?? templates[0];
  const textoBase = templates.find((t) => t.id === templateAtualId)?.mensagem
    ?? templatePadrao?.mensagem
    ?? DEFAULT_MENSAGEM;

  useEffect(() => {
    if (usuario) {
      setMensagem(substituirPlaceholders(textoBase, usuario, senhaTemporaria));
    }
  }, [usuario, senhaTemporaria, textoBase]);

  if (!usuario) return null;

  const telefone =
    formatarTelefone(usuario.telefone_corporativo) ||
    formatarTelefone(usuario.telefone);

  const copiar = async (texto: string, setter: (v: boolean) => void) => {
    await navigator.clipboard.writeText(texto);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!telefone) return;
    window.open(
      `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setZapEnviado(true);
    salvarOnboardingLog({
      usuarioId: usuario.id,
      templateId: templateAtualId ?? undefined,
      tipoEnvio: "WHATSAPP",
      telefone,
    }).catch(() => {});
  };

  const handleEmail = async () => {
    setEnviandoEmail(true);
    const res = await enviarEmailOnboarding({
      usuarioId: usuario.id,
      email: usuario.email,
      mensagem,
      templateId: templateAtualId ?? undefined,
    });
    setEnviandoEmail(false);
    if (res.success) {
      setEmailEnviado(true);
      toast.success("E-mail de boas-vindas enviado!");
    } else {
      toast.error(res.error ?? "Erro ao enviar e-mail");
    }
  };

  const mudarTemplate = (t: OnboardingTemplate) => {
    setTemplateAtualId(t.id);
    if (usuario) setMensagem(substituirPlaceholders(t.mensagem, usuario, senhaTemporaria));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#080e1a] border-indigo-500/10 text-white max-w-2xl rounded-[2rem] p-0 overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="p-8 border-b border-white/5 bg-gradient-to-b from-indigo-600/8 to-transparent flex-shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-600/15 border border-indigo-500/20">
                <Sparkles className="text-indigo-400 w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">
                  Onboarding <span className="text-indigo-400">Alpha</span>
                </DialogTitle>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-0.5">
                  Acesso provisionado com sucesso
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">

          {/* BLOCO 1 — Resumo */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/3 border border-white/5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-black text-indigo-400 uppercase">
                {usuario.nome.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-white text-lg leading-tight truncate">{usuario.nome}</h3>
              <p className="text-[10px] text-slate-400 font-bold">@{usuario.usuario}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Mail size={10} className="text-slate-600" />
                <p className="text-[10px] text-slate-500 truncate">{usuario.email}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black">
                {usuario.role}
              </span>
              {telefone ? (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black flex items-center gap-1">
                  <Phone size={9} />WhatsApp OK
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-slate-700/30 border border-slate-600/20 text-slate-600 text-[9px] font-black flex items-center gap-1">
                  <Phone size={9} />Sem telefone
                </span>
              )}
            </div>
          </div>

          {/* BLOCO 2 — Credenciais */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Key size={13} className="text-amber-400" />
              Credenciais de Acesso
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {/* Login */}
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5">
                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2">Login</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-black text-white bg-black/40 px-3 py-2 rounded-xl truncate">
                    {usuario.email}
                  </code>
                  <button
                    type="button"
                    onClick={() => copiar(usuario.email, setCopiadoLogin)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    {copiadoLogin ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Senha */}
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] text-amber-500 uppercase font-black tracking-widest">Senha Temp.</p>
                  <div className="flex items-center gap-1">
                    <Lock size={8} className="text-amber-700" />
                    <span className="text-[7px] text-amber-700 font-black uppercase">Ver 1x</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-black text-amber-300 bg-black/40 px-3 py-2 rounded-xl truncate">
                    {senhaTemporaria}
                  </code>
                  <button
                    type="button"
                    onClick={() => copiar(senhaTemporaria, setCopiadoSenha)}
                    className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    {copiadoSenha ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-1">
              <ShieldAlert size={11} className="text-amber-700 flex-shrink-0" />
              <p className="text-[9px] text-slate-600 font-bold">
                Senha exibida apenas agora. Usuário obrigado a redefinir no primeiro acesso.
              </p>
            </div>
          </div>

          {/* BLOCO 3 — Templates */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Template de Mensagem
              </h4>
              <div className="flex flex-wrap gap-2">
                {templates.filter((t) => t.ativo).map((t) => {
                  const ativo = templateAtualId === t.id || (!templateAtualId && t.padrao) || (!templateAtualId && !templatePadrao && templates[0]?.id === t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => mudarTemplate(t)}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${
                        ativo
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30"
                          : "bg-white/5 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      {t.nome}
                      {t.setor && (
                        <span className="ml-1 opacity-60">({t.setor})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* BLOCO 4 — Preview mensagem */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <MessageCircle size={13} className="text-emerald-400" />
              Mensagem de Boas-Vindas
            </h4>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={8}
              className="w-full rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500/30 focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none font-mono"
            />
            <div className="flex flex-wrap gap-1.5">
              {["[NOME]", "[LOGIN]", "[SENHA]", "[EMAIL]", "[SETOR]", "[LINK]"].map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => setMensagem((m) => m + ph)}
                  className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[8px] font-black hover:bg-indigo-500/20 transition-colors"
                >
                  {ph}
                </button>
              ))}
            </div>
          </div>

          {/* BLOCO 5 — QR Code */}
          <div className="rounded-2xl bg-white/3 border border-white/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
            >
              <QrCode size={14} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex-1">
                QR Code de Acesso
              </span>
              <span className="text-[9px] text-slate-600 font-bold">{showQr ? "Ocultar" : "Mostrar"}</span>
            </button>
            {showQr && (
              <div className="flex items-center gap-6 p-4 border-t border-white/5">
                <div className="p-3 bg-white rounded-xl flex-shrink-0">
                  <QRCode value={PANEL_URL} size={88} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold mb-1">Painel Alpha</p>
                  <p className="text-[9px] text-slate-600 font-mono break-all">{PANEL_URL}</p>
                  <p className="text-[9px] text-slate-700 mt-2">
                    Escaneie para acessar o sistema diretamente
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* AÇÕES */}
          <div className="pt-4 border-t border-white/5 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Button
                onClick={() => copiar(mensagem, setCopiadoMsg)}
                className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 h-12 font-bold rounded-xl"
              >
                {copiadoMsg
                  ? <Check className="mr-2 w-4 h-4 text-emerald-400" />
                  : <Copy className="mr-2 w-4 h-4" />
                }
                {copiadoMsg ? "Copiado!" : "Copiar"}
              </Button>

              <Button
                onClick={handleWhatsApp}
                disabled={!telefone}
                className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white h-12 font-bold rounded-xl disabled:opacity-40 shadow-lg shadow-emerald-900/20"
              >
                <MessageCircle className="mr-2 w-4 h-4" />
                {zapEnviado ? "Aberto!" : "WhatsApp"}
              </Button>

              <Button
                onClick={handleEmail}
                disabled={enviandoEmail || emailEnviado}
                className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white h-12 font-bold rounded-xl disabled:opacity-40 shadow-lg shadow-blue-900/20"
              >
                <Send className="mr-2 w-4 h-4" />
                {enviandoEmail ? "Enviando..." : emailEnviado ? "Enviado!" : "E-mail"}
              </Button>
            </div>

            <Button
              onClick={onClose}
              variant="ghost"
              className="cursor-pointer w-full h-12 font-bold rounded-xl border border-white/5 text-slate-500 hover:text-white hover:border-white/10"
            >
              <X className="mr-2 w-4 h-4" />
              Fechar — senha será ocultada
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
