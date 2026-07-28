"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CriarEventoFinanceiro } from "@/actions/CommissionEvents";
import { BuscarTodosUsuarios } from "@/actions/RecursosHumanos";

interface ModalNovoLancamentoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriado?: () => void;
}

interface UsuarioOpcao {
  id: number;
  nome: string;
}

const CAMPOS_OBRIGATORIOS_VAZIOS = {
  cnpj: "",
  razaoSocial: "",
  servico: "",
  eventDate: new Date().toISOString().slice(0, 10),
  valorReais: "",
};

/**
 * Cria um CommissionEvent manual (eventType MANUAL_EVENT) fora do fluxo de sincronização
 * automática — para casos que a integração com CS&NPS/Metas não cobre. Reaproveita a
 * mesma Server Action (`CriarEventoFinanceiro`) que já existia sem UI conectada.
 */
export function ModalNovoLancamento({ open, onOpenChange, onCriado }: ModalNovoLancamentoProps) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(CAMPOS_OBRIGATORIOS_VAZIOS);
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [buscaColaborador, setBuscaColaborador] = useState("");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;

    let cancelado = false;
    void (async () => {
      setForm(CAMPOS_OBRIGATORIOS_VAZIOS);
      setSelecionados(new Set());
      setBuscaColaborador("");
      setCarregandoUsuarios(true);

      const resultado = await BuscarTodosUsuarios();
      if (cancelado) return;

      if (resultado.success) {
        setUsuarios(
          resultado.data
            .filter((u) => u.status === "ATIVO")
            .map((u) => ({ id: u.id, nome: u.nome })),
        );
      }
      setCarregandoUsuarios(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [open]);

  function alternarColaborador(id: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) {
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
  }

  const usuariosFiltrados = usuarios.filter((u) =>
    u.nome.toLowerCase().includes(buscaColaborador.toLowerCase()),
  );

  function criar() {
    const numero = Number(form.valorReais.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(numero) || numero <= 0) {
      toast.error("Informe um valor de contrato válido.");
      return;
    }
    if (selecionados.size === 0) {
      toast.error("Selecione ao menos um colaborador.");
      return;
    }

    const valorCents = Math.round(numero * 100);

    startTransition(async () => {
      const resultado = await CriarEventoFinanceiro({
        cnpj: form.cnpj,
        razaoSocial: form.razaoSocial,
        servico: form.servico,
        eventDate: new Date(form.eventDate),
        grossContractAmountCents: valorCents,
        netContractAmountCents: valorCents,
        collaboratorIds: Array.from(selecionados),
      });

      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao criar lançamento");
        return;
      }

      toast.success("Lançamento manual criado.");
      onOpenChange(false);
      onCriado?.();
    });
  }

  const formValido =
    form.cnpj.trim().length > 0 &&
    form.razaoSocial.trim().length > 0 &&
    form.servico.trim().length > 0 &&
    form.valorReais.trim().length > 0 &&
    selecionados.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-slate-950 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-200">Novo Lançamento Manual</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-xs text-slate-500">
            Use para casos que a sincronização automática (CS&amp;NPS/Metas) não cobre. O motor de
            regras calcula comissão/prêmio/DSR normalmente a partir destes dados.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-slate-500">CNPJ</label>
              <Input
                value={form.cnpj}
                onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                placeholder="00.000.000/0001-00"
                className="border-white/10 bg-slate-900/40"
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs text-slate-500">Razão social</label>
              <Input
                value={form.razaoSocial}
                onChange={(e) => setForm((f) => ({ ...f, razaoSocial: e.target.value }))}
                className="border-white/10 bg-slate-900/40"
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs text-slate-500">Serviço</label>
              <Input
                value={form.servico}
                onChange={(e) => setForm((f) => ({ ...f, servico: e.target.value }))}
                className="border-white/10 bg-slate-900/40"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">Data do evento</label>
              <Input
                type="date"
                value={form.eventDate}
                onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                className="border-white/10 bg-slate-900/40"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">Valor do contrato (R$)</label>
              <Input
                inputMode="decimal"
                value={form.valorReais}
                onChange={(e) => setForm((f) => ({ ...f, valorReais: e.target.value }))}
                placeholder="22000,00"
                className="border-white/10 bg-slate-900/40"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">Colaboradores envolvidos</label>
            <Input
              value={buscaColaborador}
              onChange={(e) => setBuscaColaborador(e.target.value)}
              placeholder="Buscar por nome..."
              className="mb-2 border-white/10 bg-slate-900/40"
            />

            {carregandoUsuarios ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-4 animate-spin text-slate-500" aria-hidden="true" />
              </div>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/5 bg-slate-900/40 p-2">
                {usuariosFiltrados.length === 0 ? (
                  <p className="p-2 text-xs text-slate-500">Nenhum colaborador encontrado.</p>
                ) : (
                  usuariosFiltrados.map((u) => (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                    >
                      <Checkbox
                        checked={selecionados.has(u.id)}
                        onCheckedChange={() => alternarColaborador(u.id)}
                      />
                      {u.nome}
                    </label>
                  ))
                )}
              </div>
            )}
            {selecionados.size > 0 && (
              <p className="mt-1 text-xs text-slate-500">{selecionados.size} selecionado(s)</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="border-white/10" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={criar} disabled={!formValido || isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Criar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
