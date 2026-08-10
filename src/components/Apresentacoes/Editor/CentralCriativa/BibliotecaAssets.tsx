"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { Box, Eraser, ImageIcon, Loader2, Music2, Plus, ScanLine, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExcluirAssetApresentacao } from "@/actions/apresentacao-assets";
import { assetApresentacaoSchema, formatarTamanhoAsset, type AssetApresentacao, type TipoAsset } from "@/lib/apresentacoes/assets";
import { criarContornoImagem, removerFundoPelasBordas } from "@/lib/apresentacoes/remover-fundo";

interface BibliotecaAssetsProps {
  apresentacaoId: string;
  assets: AssetApresentacao[];
  onAssetsChange: (assets: AssetApresentacao[]) => void;
  onInsert: (asset: AssetApresentacao) => void;
}

const FILTROS: Array<{ tipo: TipoAsset | "TODOS"; label: string }> = [
  { tipo: "TODOS", label: "Todos" }, { tipo: "IMAGEM", label: "Imagens" },
  { tipo: "VIDEO", label: "Vídeos" }, { tipo: "AUDIO", label: "Áudios" }, { tipo: "MODELO_3D", label: "3D" },
];

async function enviarArquivo(apresentacaoId: string, arquivo: File): Promise<AssetApresentacao> {
  const formData = new FormData();
  formData.set("apresentacaoId", apresentacaoId);
  formData.set("file", arquivo);
  const response = await fetch("/api/apresentacoes/assets", { method: "POST", body: formData });
  const payload: unknown = await response.json();
  if (!response.ok || typeof payload !== "object" || payload === null || !("asset" in payload)) {
    const mensagem = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
      ? payload.error : "Falha ao enviar arquivo.";
    throw new Error(mensagem);
  }
  const asset = assetApresentacaoSchema.safeParse(payload.asset);
  if (!asset.success) throw new Error("O servidor retornou um arquivo inválido.");
  return asset.data;
}

function AssetPreview({ asset }: { asset: AssetApresentacao }) {
  if (asset.tipo === "IMAGEM") return <Image src={asset.url} alt="" fill unoptimized sizes="180px" className="object-cover" />;
  if (asset.tipo === "VIDEO") return <video src={asset.url} muted preload="metadata" className="h-full w-full object-cover" />;
  const Icon = asset.tipo === "AUDIO" ? Music2 : Box;
  return <Icon size={30} className="text-slate-500" aria-hidden="true" />;
}

export function BibliotecaAssets({ apresentacaoId, assets, onAssetsChange, onInsert }: BibliotecaAssetsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<TipoAsset | "TODOS">("TODOS");
  const [enviando, setEnviando] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [tolerancia, setTolerancia] = useState(42);
  const [corContorno, setCorContorno] = useState("#ffffff");
  const [espessuraContorno, setEspessuraContorno] = useState(8);
  const [assetProcessar, setAssetProcessar] = useState<AssetApresentacao | null>(null);
  const [assetExcluir, setAssetExcluir] = useState<AssetApresentacao | null>(null);

  const filtrados = useMemo(() => assets.filter((asset) => {
    const correspondeTipo = filtro === "TODOS" || asset.tipo === filtro;
    return correspondeTipo && asset.nomeOriginal.toLowerCase().includes(busca.trim().toLowerCase());
  }), [assets, busca, filtro]);

  async function handleArquivos(arquivos: FileList | null) {
    if (!arquivos?.length || enviando) return;
    setEnviando(true);
    const novos: AssetApresentacao[] = [];
    try {
      for (const arquivo of Array.from(arquivos).slice(0, 8)) novos.push(await enviarArquivo(apresentacaoId, arquivo));
      onAssetsChange([...novos.reverse(), ...assets]);
      toast.success(`${novos.length} arquivo(s) adicionado(s) à biblioteca.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar arquivo.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleProcessarImagem(asset: AssetApresentacao, acao: "remover-fundo" | "criar-contorno") {
    setProcessandoId(asset.id);
    try {
      const blob = acao === "remover-fundo"
        ? await removerFundoPelasBordas(asset.url, tolerancia)
        : await criarContornoImagem(asset.url, tolerancia, { cor: corContorno, espessura: espessuraContorno });
      const nomeBase = asset.nomeOriginal.replace(/\.[^.]+$/, "");
      const sufixo = acao === "remover-fundo" ? "sem-fundo" : "com-contorno";
      const novo = await enviarArquivo(apresentacaoId, new File([blob], `${nomeBase}-${sufixo}.png`, { type: "image/png" }));
      onAssetsChange([novo, ...assets]);
      toast.success(acao === "remover-fundo" ? "PNG transparente criado e salvo na biblioteca." : "PNG com contorno criado e salvo na biblioteca.");
      setAssetProcessar(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível processar a imagem.");
    } finally {
      setProcessandoId(null);
    }
  }

  async function confirmarExclusao() {
    if (!assetExcluir) return;
    const resultado = await ExcluirAssetApresentacao(assetExcluir.id);
    if (resultado.success) {
      onAssetsChange(assets.filter((asset) => asset.id !== assetExcluir.id));
      toast.success("Arquivo excluído.");
      setAssetExcluir(null);
    } else toast.error(resultado.error);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar na biblioteca" aria-label="Buscar arquivos" className="w-full rounded-xl border border-white/10 bg-slate-900/70 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-indigo-500" />
        </div>
        <input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg,.glb,.gltf" onChange={(event) => void handleArquivos(event.target.files)} className="sr-only" />
        <button onClick={() => inputRef.current?.click()} disabled={enviando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {enviando ? "Enviando..." : "Enviar arquivos"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((item) => <button key={item.tipo} onClick={() => setFiltro(item.tipo)} className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${filtro === item.tipo ? "bg-indigo-500/20 text-indigo-300" : "bg-white/5 text-slate-400 hover:text-white"}`}>{item.label}</button>)}
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">Tolerância do fundo
          <input type="range" min={12} max={100} value={tolerancia} onChange={(event) => setTolerancia(Number(event.target.value))} aria-label="Tolerância para remover fundo" className="w-24 accent-indigo-500" />
          <span className="w-6 tabular-nums">{tolerancia}</span>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {filtrados.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 text-center text-slate-500">
            <ImageIcon size={34} aria-hidden="true" /><div><p className="text-sm font-medium text-slate-300">Nenhum arquivo encontrado</p><p className="mt-1 text-xs">Envie sua própria mídia licenciada para começar.</p></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filtrados.map((asset) => (
              <article key={asset.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
                <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-slate-950"><AssetPreview asset={asset} /></div>
                <div className="space-y-2 p-3">
                  <div><p className="truncate text-xs font-medium text-slate-200" title={asset.nomeOriginal}>{asset.nomeOriginal}</p><p className="mt-0.5 text-[10px] text-slate-500">{formatarTamanhoAsset(asset.tamanhoBytes)}</p></div>
                  <div className="flex gap-1.5">
                    <button onClick={() => onInsert(asset)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600/90 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500"><Plus size={12} /> Inserir</button>
                    {asset.tipo === "IMAGEM" && <button onClick={() => setAssetProcessar(asset)} disabled={processandoId !== null} aria-label={`Processar ${asset.nomeOriginal}`} title="Remover fundo ou criar contorno" className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white disabled:opacity-50">{processandoId === asset.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}</button>}
                    <button onClick={() => setAssetExcluir(asset)} aria-label={`Excluir ${asset.nomeOriginal}`} className="rounded-lg border border-white/10 p-1.5 text-slate-500 hover:border-red-500/30 hover:text-red-400"><Trash2 size={13} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={assetExcluir !== null} onOpenChange={(open) => !open && setAssetExcluir(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir arquivo da biblioteca?</AlertDialogTitle><AlertDialogDescription>O arquivo será apagado permanentemente. A exclusão será bloqueada se ele ainda estiver em uso em algum slide.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void confirmarExclusao()} className="bg-red-600 hover:bg-red-500">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <Dialog open={assetProcessar !== null} onOpenChange={(open) => !open && setAssetProcessar(null)}>
        <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-lg">
          <DialogHeader><DialogTitle>Processar imagem</DialogTitle><DialogDescription className="text-slate-400">O original será preservado e o resultado ficará salvo como um novo PNG.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={!assetProcessar || processandoId !== null} onClick={() => assetProcessar && void handleProcessarImagem(assetProcessar, "remover-fundo")} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-left hover:border-indigo-400/40 hover:bg-indigo-500/10 disabled:opacity-50"><Eraser size={20} className="mb-3 text-indigo-300" /><strong className="block text-sm">Remover fundo</strong><span className="mt-1 block text-xs leading-5 text-slate-500">Torna transparente o fundo conectado às bordas.</span></button>
            <button type="button" disabled={!assetProcessar || processandoId !== null} onClick={() => assetProcessar && void handleProcessarImagem(assetProcessar, "criar-contorno")} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-left hover:border-sky-400/40 hover:bg-sky-500/10 disabled:opacity-50"><ScanLine size={20} className="mb-3 text-sky-300" /><strong className="block text-sm">Criar contorno</strong><span className="mt-1 block text-xs leading-5 text-slate-500">Remove o fundo e adiciona uma borda ao redor da silhueta.</span></button>
          </div>
          <div className="grid gap-3 rounded-xl border border-white/10 bg-slate-900/40 p-3 sm:grid-cols-2">
            <label className="text-xs text-slate-400">Cor do contorno<div className="mt-1 flex gap-2"><input type="color" value={corContorno} onChange={(event) => setCorContorno(event.target.value)} className="h-9 w-12 rounded border border-white/10 bg-transparent" /><input value={corContorno} onChange={(event) => setCorContorno(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-2 text-xs text-white" /></div></label>
            <label className="text-xs text-slate-400">Espessura: {espessuraContorno}px<input type="range" min={1} max={32} value={espessuraContorno} onChange={(event) => setEspessuraContorno(Number(event.target.value))} className="mt-3 w-full accent-sky-500" /></label>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
