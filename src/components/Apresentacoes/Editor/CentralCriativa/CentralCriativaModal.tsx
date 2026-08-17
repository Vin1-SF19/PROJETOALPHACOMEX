"use client";

import { useState } from "react";
import { Boxes, CircleHelp, Maximize2, Palette, Sparkles, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AssetApresentacao } from "@/lib/apresentacoes/assets";
import type { TemaResumo } from "../ApresentacaoEditor";
import { COMPONENTES_REGISTRY } from "../registry/componentes-registry";
import { useEditorStore } from "../store/useEditorStore";
import { BibliotecaAssets } from "./BibliotecaAssets";
import { BrandKitPanel } from "./BrandKitPanel";
import { ResizeExportPanel } from "./ResizeExportPanel";
import { PresetsAnimacaoPanel } from "./PresetsAnimacaoPanel";
import { CentralCriativaTutorial } from "./CentralCriativaTutorial";

interface CentralCriativaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apresentacaoId: string;
  titulo: string;
  assetsIniciais: AssetApresentacao[];
  temaAtual: TemaResumo | null;
  onTemaAplicado: (tema: TemaResumo) => void;
}

export function CentralCriativaModal({
  open,
  onOpenChange,
  apresentacaoId,
  titulo,
  assetsIniciais,
  temaAtual,
  onTemaAplicado,
}: CentralCriativaModalProps) {
  const [assets, setAssets] = useState(assetsIniciais);
  const [tutorialAberto, setTutorialAberto] = useState(false);
  const canvas = useEditorStore((state) => state.canvas);
  const adicionarComponente = useEditorStore((state) => state.adicionarComponente);
  const atualizarFundoCanvas = useEditorStore((state) => state.atualizarFundoCanvas);

  function aplicarTemaCriado(tema: TemaResumo) {
    atualizarFundoCanvas(tema.corSecundaria);
    onTemaAplicado(tema);
  }

  function inserirAsset(asset: AssetApresentacao) {
    const centro = (largura: number, altura: number) => ({
      x: Math.max(0, (canvas.width - largura) / 2),
      y: Math.max(0, (canvas.height - altura) / 2),
    });

    if (asset.tipo === "IMAGEM") {
      const posicao = centro(480, 320);
      const base = COMPONENTES_REGISTRY.imagem.criarComponentePadrao(posicao.x, posicao.y);
      if (base.tipo === "imagem") adicionarComponente({ ...base, w: 480, h: 320, url: asset.url, alt: asset.nomeOriginal });
    } else if (asset.tipo === "VIDEO") {
      const posicao = centro(640, 360);
      const base = COMPONENTES_REGISTRY.video.criarComponentePadrao(posicao.x, posicao.y);
      if (base.tipo === "video") adicionarComponente({ ...base, w: 640, h: 360, url: asset.url });
    } else if (asset.tipo === "AUDIO") {
      const posicao = centro(520, 76);
      const base = COMPONENTES_REGISTRY.audio.criarComponentePadrao(posicao.x, posicao.y);
      if (base.tipo === "audio") adicionarComponente({ ...base, w: 520, h: 76, url: asset.url, titulo: asset.nomeOriginal });
    } else {
      const tamanho = Math.min(420, canvas.width * 0.55, canvas.height * 0.7);
      const posicao = centro(tamanho, tamanho);
      const base = COMPONENTES_REGISTRY.objeto3d.criarComponentePadrao(posicao.x, posicao.y);
      if (base.tipo === "objeto3d") adicionarComponente({ ...base, w: tamanho, h: tamanho, url: asset.url });
    }

    toast.success(`${asset.nomeOriginal} inserido no slide.`);
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="grid h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-none grid-rows-[auto_1fr] gap-0 overflow-hidden rounded-2xl border-white/10 bg-slate-950 p-0 text-slate-200 shadow-2xl sm:h-[min(94dvh,960px)] sm:w-[min(96vw,1280px)] sm:max-w-none sm:rounded-3xl"
      >
        <DialogHeader className="relative overflow-hidden border-b border-white/10 bg-gradient-to-r from-indigo-500/15 via-slate-950 to-sky-500/10 px-4 py-4 pr-14 text-left sm:px-6 sm:py-5 sm:pr-16">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/15 text-indigo-300 shadow-lg shadow-indigo-950/30">
              <Sparkles size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate text-base text-white sm:text-lg">Central Criativa Alpha</DialogTitle>
              <DialogDescription className="mt-1 line-clamp-2 text-xs text-slate-400 sm:text-sm">
                Mídias, presets, identidade visual, formatos e exportação no mesmo workspace.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTutorialAberto(true)}
            className="absolute right-14 top-3 flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:right-16 sm:top-5"
          >
            <CircleHelp size={15} aria-hidden="true" /> <span className="hidden sm:inline">Tutorial</span>
          </button>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Fechar Central Criativa"
              className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:right-5 sm:top-5"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </DialogClose>
        </DialogHeader>
        <Tabs defaultValue="biblioteca" className="min-h-0 overflow-hidden gap-0">
          <div className="shrink-0 overflow-x-auto border-b border-white/10 bg-slate-950/95 px-3 py-2.5 sm:px-6 sm:py-3">
            <TabsList className="h-11 w-max min-w-full justify-start sm:min-w-0">
              <TabsTrigger value="biblioteca" className="min-w-36 px-4"><Boxes size={14} /> Biblioteca</TabsTrigger>
              <TabsTrigger value="presets" className="min-w-36 px-4"><Wand2 size={14} /> Presets</TabsTrigger>
              <TabsTrigger value="marca" className="min-w-36 px-4"><Palette size={14} /> Brand Kit</TabsTrigger>
              <TabsTrigger value="formato" className="min-w-48 px-4"><Maximize2 size={14} /> Formato e exportação</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="biblioteca" className="min-h-0 overflow-hidden p-3 sm:p-5 lg:p-6">
            <BibliotecaAssets apresentacaoId={apresentacaoId} assets={assets} onAssetsChange={setAssets} onInsert={inserirAsset} />
          </TabsContent>
          <TabsContent value="presets" className="min-h-0 overflow-hidden p-3 sm:p-5 lg:p-6">
            <PresetsAnimacaoPanel />
          </TabsContent>
          <TabsContent value="marca" className="min-h-0 overflow-y-auto p-3 sm:p-5 lg:p-6">
            <BrandKitPanel apresentacaoId={apresentacaoId} assets={assets} temaAtual={temaAtual} onTemaAplicado={aplicarTemaCriado} onInsertLogo={inserirAsset} onAssetsChange={setAssets} />
          </TabsContent>
          <TabsContent value="formato" className="min-h-0 overflow-y-auto p-3 sm:p-5 lg:p-6">
            <ResizeExportPanel titulo={titulo} temaId={temaAtual?.id ?? null} assets={assets} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    <CentralCriativaTutorial open={tutorialAberto} onOpenChange={setTutorialAberto} />
    </>
  );
}
