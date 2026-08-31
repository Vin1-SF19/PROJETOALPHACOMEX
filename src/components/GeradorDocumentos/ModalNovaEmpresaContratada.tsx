"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CriarEmpresaContratada, ConsultarCnpjParaQualificacao } from "@/actions/empresas-contratadas";

export interface EmpresaContratadaResumo {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  naturezaJuridica: string | null;
}

interface FormEmpresaContratada {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  naturezaJuridica: string;
  representanteLegalNome: string;
  representanteLegalCpf: string;
  representanteLegalCargo: string;
}

const FORM_VAZIO: FormEmpresaContratada = {
  cnpj: "",
  razaoSocial: "",
  nomeFantasia: "",
  logradouro: "",
  numero: "",
  bairro: "",
  municipio: "",
  uf: "",
  cep: "",
  naturezaJuridica: "",
  representanteLegalNome: "",
  representanteLegalCpf: "",
  representanteLegalCargo: "",
};

export function ModalNovaEmpresaContratada({
  open,
  onOpenChange,
  onCriada,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriada: (empresa: EmpresaContratadaResumo) => void;
}) {
  const [form, setForm] = useState<FormEmpresaContratada>(FORM_VAZIO);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [isPending, startTransition] = useTransition();

  function atualizarCampo(campo: keyof FormEmpresaContratada, valor: string) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function buscarNaReceitaFederal() {
    const cnpjLimpo = form.cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      toast.error("Informe um CNPJ válido (14 dígitos) antes de buscar");
      return;
    }
    setBuscandoCnpj(true);
    try {
      const resultado = await ConsultarCnpjParaQualificacao(cnpjLimpo);
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      setForm((anterior) => ({
        ...anterior,
        razaoSocial: resultado.data.razaoSocial || anterior.razaoSocial,
        nomeFantasia: resultado.data.nomeFantasia || anterior.nomeFantasia,
        logradouro: resultado.data.logradouro || anterior.logradouro,
        numero: resultado.data.numero || anterior.numero,
        bairro: resultado.data.bairro || anterior.bairro,
        municipio: resultado.data.municipio || anterior.municipio,
        uf: resultado.data.uf || anterior.uf,
        cep: resultado.data.cep || anterior.cep,
        naturezaJuridica: resultado.data.naturezaJuridica || anterior.naturezaJuridica,
      }));
      toast.success("Dados da Receita Federal preenchidos");
    } finally {
      setBuscandoCnpj(false);
    }
  }

  function resetar() {
    setForm(FORM_VAZIO);
  }

  function handleSalvar() {
    if (!form.cnpj.trim() || !form.razaoSocial.trim()) {
      toast.error("Informe ao menos CNPJ e razão social");
      return;
    }

    startTransition(async () => {
      const resultado = await CriarEmpresaContratada({
        ...form,
        nomeFantasia: form.nomeFantasia.trim() || undefined,
        logradouro: form.logradouro.trim() || undefined,
        numero: form.numero.trim() || undefined,
        bairro: form.bairro.trim() || undefined,
        municipio: form.municipio.trim() || undefined,
        uf: form.uf.trim() || undefined,
        cep: form.cep.trim() || undefined,
        naturezaJuridica: form.naturezaJuridica.trim() || undefined,
        representanteLegalNome: form.representanteLegalNome.trim() || undefined,
        representanteLegalCpf: form.representanteLegalCpf.trim() || undefined,
        representanteLegalCargo: form.representanteLegalCargo.trim() || undefined,
      });

      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }

      toast.success("Empresa contratada cadastrada");
      onCriada({
        id: resultado.empresaId,
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim() || null,
        cnpj: form.cnpj.replace(/\D/g, ""),
        logradouro: form.logradouro.trim() || null,
        numero: form.numero.trim() || null,
        bairro: form.bairro.trim() || null,
        municipio: form.municipio.trim() || null,
        uf: form.uf.trim() || null,
        cep: form.cep.trim() || null,
        naturezaJuridica: form.naturezaJuridica.trim() || null,
      });
      resetar();
      onOpenChange(false);
    });
  }

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (!next) resetar();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova empresa contratada</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="cnpj-contratada">CNPJ</Label>
              <Input
                id="cnpj-contratada"
                value={form.cnpj}
                onChange={(e) => atualizarCampo("cnpj", e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <Button type="button" variant="secondary" onClick={buscarNaReceitaFederal} disabled={buscandoCnpj}>
              {buscandoCnpj ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
              Buscar na Receita Federal
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="razao-social-contratada">Razão social</Label>
              <Input id="razao-social-contratada" value={form.razaoSocial} onChange={(e) => atualizarCampo("razaoSocial", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="nome-fantasia-contratada">Nome fantasia</Label>
              <Input id="nome-fantasia-contratada" value={form.nomeFantasia} onChange={(e) => atualizarCampo("nomeFantasia", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="natureza-juridica-contratada">Natureza jurídica</Label>
              <Input id="natureza-juridica-contratada" value={form.naturezaJuridica} onChange={(e) => atualizarCampo("naturezaJuridica", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cep-contratada">CEP</Label>
              <Input id="cep-contratada" value={form.cep} onChange={(e) => atualizarCampo("cep", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="logradouro-contratada">Logradouro</Label>
              <Input id="logradouro-contratada" value={form.logradouro} onChange={(e) => atualizarCampo("logradouro", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="numero-contratada">Número</Label>
              <Input id="numero-contratada" value={form.numero} onChange={(e) => atualizarCampo("numero", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bairro-contratada">Bairro</Label>
              <Input id="bairro-contratada" value={form.bairro} onChange={(e) => atualizarCampo("bairro", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="municipio-contratada">Município</Label>
              <Input id="municipio-contratada" value={form.municipio} onChange={(e) => atualizarCampo("municipio", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="uf-contratada">UF</Label>
              <Input id="uf-contratada" value={form.uf} onChange={(e) => atualizarCampo("uf", e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
            </div>
          </div>

          <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Representante legal</h4>
            <p className="text-xs text-neutral-400">
              A Receita Federal não retorna o representante legal formal — preencha manualmente.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="rep-nome-contratada">Nome</Label>
                <Input id="rep-nome-contratada" value={form.representanteLegalNome} onChange={(e) => atualizarCampo("representanteLegalNome", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rep-cpf-contratada">CPF</Label>
                <Input id="rep-cpf-contratada" value={form.representanteLegalCpf} onChange={(e) => atualizarCampo("representanteLegalCpf", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-3">
                <Label htmlFor="rep-cargo-contratada">Cargo</Label>
                <Input id="rep-cargo-contratada" value={form.representanteLegalCargo} onChange={(e) => atualizarCampo("representanteLegalCargo", e.target.value)} placeholder="Ex: Diretor, Sócio-administrador" />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={isPending}>
            {isPending ? "Salvando..." : "Cadastrar empresa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
