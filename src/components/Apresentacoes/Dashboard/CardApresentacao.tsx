"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MonitorPlay, MoreVertical, Pencil, Copy, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DuplicarApresentacao, ExcluirApresentacao } from "@/actions/apresentacoes";
import type { MiniaturaSlideDados } from "@/lib/apresentacoes/miniatura-slide";

const MiniaturaSlideApresentacao = dynamic(
  () => import("./MiniaturaSlideApresentacao").then((modulo) => modulo.MiniaturaSlideApresentacao),
  { ssr: false },
);

export interface ApresentacaoCard {
  id: string;
  titulo: string;
  clienteNome: string | null;
  status: string;
  thumbnailUrl: string | null;
  updatedAt: Date;
  autor: { id: number; nome: string };
  _count: { slides: number };
  primeiroSlide: MiniaturaSlideDados | null;
}

const STATUS_BADGE: Record<string, { label: string; variant: "secondary" | "default" | "outline" }> = {
  DRAFT: { label: "Rascunho", variant: "secondary" },
  PUBLICADA: { label: "Publicada", variant: "default" },
  ARQUIVADA: { label: "Arquivada", variant: "outline" },
};

interface CardApresentacaoProps {
  apresentacao: ApresentacaoCard;
  accent: string;
  onAlterado: () => void;
}

export function CardApresentacao({ apresentacao, accent, onAlterado }: CardApresentacaoProps) {
  const router = useRouter();
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [processando, setProcessando] = useState(false);

  const badge = STATUS_BADGE[apresentacao.status] ?? STATUS_BADGE.DRAFT;

  function irParaEditor() {
    router.push(`/PainelAlpha/Apresentacoes/${apresentacao.id}/editor`);
  }

  async function handleDuplicar() {
    setProcessando(true);
    try {
      const res = await DuplicarApresentacao(apresentacao.id);
      if (res.success) {
        toast.success("Apresentação duplicada.");
        onAlterado();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Erro ao duplicar.");
      }
    } catch {
      toast.error("Falha na comunicação com o servidor.");
    } finally {
      setProcessando(false);
    }
  }

  async function handleExcluir() {
    setProcessando(true);
    try {
      const res = await ExcluirApresentacao(apresentacao.id);
      if (res.success) {
        toast.success("Apresentação excluída.");
        onAlterado();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Erro ao excluir.");
      }
    } catch {
      toast.error("Falha na comunicação com o servidor.");
    } finally {
      setProcessando(false);
      setConfirmarExclusao(false);
    }
  }

  return (
    <div className="group relative flex flex-col bg-slate-950/70 border border-white/5 rounded-[2rem] overflow-hidden transition-colors duration-300 hover:border-white/10">
      <button
        onClick={irParaEditor}
        aria-label={`Editar apresentação ${apresentacao.titulo}`}
        className="relative aspect-video w-full overflow-hidden bg-slate-900 cursor-pointer"
      >
        {apresentacao.primeiroSlide ? (
          <MiniaturaSlideApresentacao miniatura={apresentacao.primeiroSlide} />
        ) : apresentacao.thumbnailUrl ? (
          <Image
            src={apresentacao.thumbnailUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: `linear-gradient(135deg, rgba(${accent},0.18), rgba(2,6,23,0.9))` }}
          >
            <MonitorPlay size={40} style={{ color: `rgba(${accent},0.7)` }} aria-hidden="true" />
          </div>
        )}
      </button>

      <div className="relative flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <button
              onClick={irParaEditor}
              className="text-left text-sm font-bold text-white truncate hover:underline cursor-pointer block w-full"
            >
              {apresentacao.titulo}
            </button>
            {apresentacao.clienteNome && (
              <p className="text-xs text-slate-500 truncate">{apresentacao.clienteNome}</p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Ações da apresentação"
                disabled={processando}
                className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
              >
                <MoreVertical size={16} aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={irParaEditor}>
                <Pencil aria-hidden="true" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicar}>
                <Copy aria-hidden="true" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmarExclusao(true)}>
                <Trash2 aria-hidden="true" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <span className="text-[11px] text-slate-600">
            {apresentacao._count.slides} slide{apresentacao._count.slides === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-3 border-t border-white/5 text-[11px] text-slate-500">
          <User size={12} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{apresentacao.autor.nome}</span>
          <span className="ml-auto shrink-0">
            {formatDistanceToNow(new Date(apresentacao.updatedAt), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
      </div>

      <AlertDialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir apresentação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. &quot;{apresentacao.titulo}&quot; e todos os seus slides serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={processando} onClick={handleExcluir}>
              {processando ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
