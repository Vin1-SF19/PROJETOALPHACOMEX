"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronRight, FolderOpen, HardDrive, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  CriarRoadmapWorkspace,
  NavegarDiretoriosRoadmapWorkspace,
} from "@/actions/RoadmapWorkspaces";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface DirectoryEntry {
  name: string;
  path: string;
}
interface DirectoryListing {
  path: string;
  parentPath: string | null;
  directories: DirectoryEntry[];
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function NovoProjetoExternoDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState("");
  const [moduleKey, setModuleKey] = useState("");
  const [moduleKeyTouched, setModuleKeyTouched] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loadingListing, setLoadingListing] = useState(false);
  const [pending, startTransition] = useTransition();

  async function browse(path?: string) {
    setLoadingListing(true);
    const result = await NavegarDiretoriosRoadmapWorkspace(path);
    setLoadingListing(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setListing(result.listing);
  }

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setLabel("");
      setModuleKey("");
      setModuleKeyTouched(false);
      setSelectedPath(null);
      void browse();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  function submit() {
    if (!selectedPath) {
      toast.error("Selecione uma pasta pelo navegador de diretórios");
      return;
    }
    startTransition(async () => {
      const result = await CriarRoadmapWorkspace({
        label,
        moduleKey,
        rootPath: selectedPath,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Projeto externo registrado");
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#0b1524] text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo projeto externo</DialogTitle>
          <DialogDescription>
            Registra um projeto fora do PainelAlpha apontando para uma pasta
            no disco do servidor. Navegue para escolher a pasta — não é
            possível digitar um caminho livremente. Depois de criado, inicie o
            worker do projeto para processar objetivos aprovados naquele
            diretório.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block text-xs text-slate-400">
            Nome do projeto
            <Input
              value={label}
              onChange={(event) => {
                setLabel(event.target.value);
                if (!moduleKeyTouched)
                  setModuleKey(slugify(event.target.value));
              }}
              maxLength={80}
              placeholder="Ex.: Sistema de Cobrança"
              className="mt-1.5 border-white/10 bg-slate-950"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Identificador
            <Input
              value={moduleKey}
              onChange={(event) => {
                setModuleKeyTouched(true);
                setModuleKey(slugify(event.target.value));
              }}
              maxLength={60}
              placeholder="sistema-de-cobranca"
              className="mt-1.5 border-white/10 bg-slate-950 font-mono"
            />
          </label>

          <div className="space-y-2">
            <p className="text-xs text-slate-400">Pasta do projeto</p>
            <div className="rounded-xl border border-white/10 bg-slate-950">
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] text-slate-500">
                <HardDrive size={13} />
                <span className="truncate">
                  {listing?.path || "Selecione uma unidade"}
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {loadingListing && (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
                    <Loader2 className="animate-spin" size={14} /> Carregando…
                  </div>
                )}
                {!loadingListing && listing?.parentPath !== undefined && listing?.parentPath !== null && (
                  <button
                    type="button"
                    onClick={() => void browse(listing.parentPath ?? undefined)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-white/5"
                  >
                    <ChevronRight className="rotate-180" size={13} /> ..
                  </button>
                )}
                {!loadingListing &&
                  listing?.directories.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      onClick={() => void browse(entry.path)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-white/5"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <FolderOpen size={13} className="shrink-0 text-amber-300" />
                        <span className="truncate">{entry.name}</span>
                      </span>
                      <ChevronRight size={13} className="shrink-0 text-slate-600" />
                    </button>
                  ))}
                {!loadingListing && listing && listing.directories.length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-slate-600">
                    Nenhuma subpasta aqui.
                  </p>
                )}
              </div>
              {listing?.path && (
                <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
                  <span className="truncate text-[10px] text-slate-500">
                    {selectedPath === listing.path
                      ? "Esta pasta está selecionada"
                      : "Use este diretório atual como projeto"}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedPath === listing.path ? "default" : "outline"}
                    className={
                      selectedPath === listing.path
                        ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                        : "border-white/10"
                    }
                    onClick={() => setSelectedPath(listing.path)}
                  >
                    Selecionar
                  </Button>
                </div>
              )}
            </div>
            {selectedPath && (
              <p className="break-all rounded-lg bg-cyan-400/[.06] px-3 py-2 text-[11px] text-cyan-300">
                {selectedPath}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={pending || !label.trim() || !moduleKey.trim() || !selectedPath}
              onClick={submit}
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              {pending && <Loader2 className="animate-spin" size={15} />}{" "}
              Registrar projeto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
