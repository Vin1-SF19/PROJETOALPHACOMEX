"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ConfirmarVinculoEmpresaCardBpm } from "@/actions/bpm/CnpjEmpresaVinculo";
import type { PropostaVinculoEmpresa } from "@/lib/bpm/cnpj-empresa-vinculo";
import type { ObterDadosEmpresaCardBpm } from "@/actions/bpm/Empresas";
import { formatCNPJ } from "@/lib/format-cnpj";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useCardSave } from "./CardSaveContext";

type DadosEmpresa = NonNullable<Awaited<ReturnType<typeof ObterDadosEmpresaCardBpm>>["data"]>;

export function VincularEmpresaCnpjDialog({ proposta, onCancelar, onVinculado, onConfirmando }: {
  proposta: PropostaVinculoEmpresa;
  onCancelar: () => void;
  onVinculado: (dados: DadosEmpresa) => void;
  onConfirmando?: (confirmando: boolean) => void;
}) {
  const { registerSave, clearFailedSave } = useCardSave();
  const chave = `${proposta.cardId}:vinculo-empresa-cnpj`;
  const [pendente, setPendente] = useState(false);
  const pendenteRef = useRef(false);
  const ativo = useRef(true);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { ativo.current = true; return () => { ativo.current = false; }; }, []);

  function cancelar() {
    if (pendenteRef.current) return;
    clearFailedSave(chave);
    onCancelar();
  }
  async function confirmar() {
    if (pendenteRef.current) return;
    pendenteRef.current = true;
    setPendente(true);
    let mensagem = "Não foi possível confirmar o vínculo. Seus dados foram preservados.";
    try {
      await registerSave(async () => {
        mensagem = "Não foi possível confirmar o vínculo. Seus dados foram preservados.";
        pendenteRef.current = true;
        if (ativo.current) { setPendente(true); setErro(null); onConfirmando?.(true); }
        try {
          const resultado = await ConfirmarVinculoEmpresaCardBpm({ proposta, confirmar: true });
          if (!resultado.success) {
            mensagem = resultado.error;
            if (ativo.current) setErro(mensagem);
            return false;
          }
          if (ativo.current) onVinculado(resultado.data);
          return true;
        } catch {
          if (ativo.current) setErro(mensagem);
          return false;
        } finally {
          pendenteRef.current = false;
          if (ativo.current) { setPendente(false); onConfirmando?.(false); }
        }
      }, proposta.cardId, chave, { failureMessage: () => mensagem });
    } finally {
      pendenteRef.current = false;
      if (ativo.current) setPendente(false);
    }
  }

  return <AlertDialog open onOpenChange={(aberto) => { if (!aberto) cancelar(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Vincular à empresa já cadastrada?</AlertDialogTitle>
        <AlertDialogDescription>
          O CNPJ {formatCNPJ(proposta.cnpj)} pertence a {proposta.empresaDestinoNome}.
          Ao confirmar, este lead será vinculado a essa empresa. O cadastro existente será preservado;
          alterações cadastrais em edição não serão aplicadas à empresa escolhida.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {erro && <p role="alert" className="text-sm text-rose-400">{erro}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pendente} onClick={(event) => { event.preventDefault(); cancelar(); }}>Manter vínculo atual</AlertDialogCancel>
        <button type="button" aria-busy={pendente} disabled={pendente} onClick={() => void confirmar()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pendente && <Loader2 size={16} className="animate-spin" />}{pendente ? "Vinculando…" : "Confirmar vínculo"}
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
