"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { getUsers } from "@/actions/get-user";
import { CompartilharApresentacao } from "@/actions/apresentacoes";

interface UsuarioSelecionavel {
  id: number;
  nome: string;
  usuario: string;
  email: string;
  cargo: string | null;
}

interface ModalCompartilharApresentacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apresentacaoId: string;
  apresentacaoTitulo: string;
  usuarioAtualId: number;
}

export function ModalCompartilharApresentacao({
  open,
  onOpenChange,
  apresentacaoId,
  apresentacaoTitulo,
  usuarioAtualId,
}: ModalCompartilharApresentacaoProps) {
  const [usuarios, setUsuarios] = useState<UsuarioSelecionavel[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [compartilhando, setCompartilhando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCarregando(true);
    getUsers()
      .then((dados) => {
        setUsuarios(
          dados
            .filter((u) => u.id !== usuarioAtualId && u.status !== "INATIVO")
            .map((u) => ({ id: u.id, nome: u.nome, usuario: u.usuario, email: u.email, cargo: u.cargo })),
        );
      })
      .finally(() => setCarregando(false));
  }, [open, usuarioAtualId]);

  function fecharEResetar() {
    onOpenChange(false);
    setBusca("");
    setSelecionados(new Set());
  }

  function alternarSelecao(id: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nome.toLowerCase().includes(termo) ||
        u.usuario.toLowerCase().includes(termo) ||
        u.email.toLowerCase().includes(termo),
    );
  }, [usuarios, busca]);

  async function handleCompartilhar() {
    if (selecionados.size === 0) {
      toast.error("Selecione ao menos um usuário.");
      return;
    }
    setCompartilhando(true);
    try {
      const res = await CompartilharApresentacao({
        apresentacaoId,
        destinatarioIds: Array.from(selecionados),
      });
      if (res.success) {
        toast.success(
          selecionados.size === 1
            ? "Apresentação compartilhada."
            : `Apresentação compartilhada com ${selecionados.size} usuários.`,
        );
        fecharEResetar();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Erro ao compartilhar apresentação.");
      }
    } catch {
      toast.error("Falha na comunicação com o servidor.");
    } finally {
      setCompartilhando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : fecharEResetar())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar apresentação</DialogTitle>
          <DialogDescription>
            Cada usuário selecionado recebe uma cópia de &quot;{apresentacaoTitulo}&quot; na própria lista de
            apresentações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} aria-hidden="true" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar usuário..."
              aria-label="Buscar usuário"
              className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {carregando ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-slate-900/60 animate-pulse" />
              ))
            ) : usuariosFiltrados.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">Nenhum usuário encontrado.</p>
            ) : (
              usuariosFiltrados.map((u) => {
                const ativo = selecionados.has(u.id);
                return (
                  <label
                    key={u.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-colors ${
                      ativo ? "border-indigo-500/40 bg-indigo-500/10" : "border-white/5 bg-slate-900/40 hover:border-white/10"
                    }`}
                  >
                    <Checkbox checked={ativo} onCheckedChange={() => alternarSelecao(u.id)} />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                        <UserRound size={14} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{u.nome}</p>
                        <p className="truncate text-xs text-slate-500">{u.cargo || u.email}</p>
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={fecharEResetar}
            disabled={compartilhando}
            className="cursor-pointer px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleCompartilhar}
            disabled={compartilhando || selecionados.size === 0}
            className="cursor-pointer px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-40"
          >
            {compartilhando
              ? "Compartilhando..."
              : selecionados.size > 0
                ? `Compartilhar (${selecionados.size})`
                : "Compartilhar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
