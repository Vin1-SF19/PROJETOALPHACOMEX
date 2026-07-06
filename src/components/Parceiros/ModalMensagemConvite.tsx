"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { substituirPlaceholders } from "@/lib/onboarding-placeholders";

type TemplateOnboarding = { id: number; nome: string; mensagem: string };

type Props = {
  open: boolean;
  onClose: () => void;
  link: string;
  pin: string;
  template: TemplateOnboarding | null;
};

function mensagemFallback(link: string, pin: string): string {
  return `Bem-vindo ao nosso programa de parceiros!\n\nPara iniciar seu cadastro, acesse o link abaixo e informe o PIN de acesso:\n\nLink: ${link}\nPIN: ${pin}\n\nEstamos ansiosos para firmar essa parceria!`;
}

export default function ModalMensagemConvite({ open, onClose, link, pin, template }: Props) {
  const mensagemFinal = template
    ? substituirPlaceholders(template.mensagem, { LINK: link, PIN: pin })
    : mensagemFallback(link, pin);

  async function copiarMensagem() {
    await navigator.clipboard.writeText(mensagemFinal).catch(() => {});
    toast.success("Mensagem copiada!");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-950 border-white/10 text-slate-200 max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white font-black uppercase italic tracking-tight">
            <Send size={18} className="text-blue-400" />
            Convite Gerado!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-400 leading-relaxed">
            Envie a mensagem abaixo para o futuro parceiro — ela já contém o link e o PIN de acesso ao convite.
          </p>

          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">
              Mensagem de Boas-vindas
            </p>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{mensagemFinal}</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={copiarMensagem}
              className="mt-2 h-7 text-[10px] text-slate-400 hover:text-white gap-1 px-2"
            >
              <Copy size={11} /> Copiar mensagem
            </Button>
          </div>

          <Button
            type="button"
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase tracking-widest text-xs h-12"
          >
            Concluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
