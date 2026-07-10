"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CriarApresentacao } from "@/actions/apresentacoes";

interface ModalNovaApresentacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function extrairMensagemErro(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const valores = Object.values(error as Record<string, string[] | undefined>)
      .flat()
      .filter(Boolean);
    if (valores.length > 0) return valores.join(" ");
  }
  return "Dados inválidos.";
}

export function ModalNovaApresentacao({ open, onOpenChange }: ModalNovaApresentacaoProps) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [criando, setCriando] = useState(false);

  function fecharEResetar() {
    onOpenChange(false);
    setTitulo("");
    setClienteNome("");
  }

  async function handleCriar() {
    if (!titulo.trim()) {
      toast.error("Título é obrigatório.");
      return;
    }

    setCriando(true);
    try {
      const res = await CriarApresentacao({ titulo, clienteNome: clienteNome || null });
      if (res.success && res.data) {
        toast.success("Apresentação criada.");
        fecharEResetar();
        router.push(`/PainelAlpha/Apresentacoes/${res.data.id}/editor`);
      } else {
        toast.error(extrairMensagemErro(res.error));
      }
    } catch {
      toast.error("Falha na comunicação com o servidor.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : fecharEResetar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova apresentação</DialogTitle>
          <DialogDescription>
            Dê um nome à sua apresentação para começar a editar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label htmlFor="nova-apresentacao-titulo" className="text-xs font-medium text-slate-400">
              Título
            </label>
            <input
              id="nova-apresentacao-titulo"
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Proposta Comercial 2026"
              maxLength={200}
              className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="nova-apresentacao-cliente" className="text-xs font-medium text-slate-400">
              Nome do cliente (opcional)
            </label>
            <input
              id="nova-apresentacao-cliente"
              type="text"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              placeholder="Ex: Alpha Comex"
              maxLength={200}
              className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={fecharEResetar}
            disabled={criando}
            className="cursor-pointer px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleCriar}
            disabled={criando}
            className="cursor-pointer px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-40"
          >
            {criando ? "Criando..." : "Criar e editar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
