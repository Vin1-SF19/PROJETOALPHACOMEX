"use client";

import { Boxes, Download, ImageIcon, Palette, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PASSOS = [
  { icon: Boxes, titulo: "Biblioteca", texto: "Envie imagens, vídeos, áudios e modelos 3D. Em imagens, use o botão de efeitos para remover o fundo ou gerar um PNG com contorno." },
  { icon: Wand2, titulo: "Presets", texto: "Crie uma sequência de animações, ajuste duração e espera e salve. O preset aparece imediatamente no painel do elemento e no botão Presets da barra superior." },
  { icon: Palette, titulo: "Brand Kit", texto: "Configure cores, fontes e logos para manter a identidade visual consistente nos slides." },
  { icon: ImageIcon, titulo: "Formato", texto: "Use Magic Resize para adaptar o canvas. Revise o enquadramento depois de trocar entre horizontal, quadrado e vertical." },
  { icon: Download, titulo: "Exportar", texto: "Arquivo HTML funciona offline. Link de apresentação publica uma URL sem login; gerar um novo link invalida o anterior." },
];

export function CentralCriativaTutorial({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-slate-950 text-white sm:max-w-2xl">
        <DialogHeader><DialogTitle>Como configurar a Central Criativa</DialogTitle><DialogDescription className="text-slate-400">Um roteiro rápido para preparar o ambiente e publicar a apresentação.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {PASSOS.map((passo, index) => <article key={passo.titulo} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4"><div className="mb-3 flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300"><passo.icon size={15} /></span><span className="text-[10px] font-bold text-slate-500">0{index + 1}</span><h3 className="text-sm font-semibold">{passo.titulo}</h3></div><p className="text-xs leading-5 text-slate-400">{passo.texto}</p></article>)}
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-100/80">Antes de exportar ou gerar o link, o Alpha Motion salva automaticamente o slide ativo. Presets são pontos de partida: depois de aplicados, cada animação continua editável na timeline.</div>
      </DialogContent>
    </Dialog>
  );
}
