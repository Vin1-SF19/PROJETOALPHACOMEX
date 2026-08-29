"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GerarDocumento, BuscarClientesParaContratante } from "@/actions/gerador-documentos";
import { ListarEmpresasContratadas } from "@/actions/empresas-contratadas";
import { ModalNovaEmpresaContratada, type EmpresaContratadaResumo } from "./ModalNovaEmpresaContratada";
import type { VariavelTemplate } from "@/lib/gerador-documentos/schemas";

interface TemplateParaGeracao {
  id: string;
  titulo: string;
  variaveis: VariavelTemplate[];
}

interface ClienteResumo {
  id: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string | null;
}

export function GerarDocumentoForm({ template }: { template: TemplateParaGeracao }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(template.titulo);
  const [valores, setValores] = useState<Record<string, string | boolean>>({});
  const [isPending, startTransition] = useTransition();

  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteResumo[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteResumo | null>(null);
  const [buscandoClientes, setBuscandoClientes] = useState(false);

  const [empresasContratadas, setEmpresasContratadas] = useState<EmpresaContratadaResumo[]>([]);
  const [empresaContratadaId, setEmpresaContratadaId] = useState<string | null>(null);
  const [modalEmpresaOpen, setModalEmpresaOpen] = useState(false);

  useEffect(() => {
    ListarEmpresasContratadas().then((res) => {
      if (res.success) setEmpresasContratadas(res.data);
    });
  }, []);

  useEffect(() => {
    if (clienteSelecionado) return;
    const timeout = setTimeout(() => {
      if (buscaCliente.trim().length >= 2) {
        setBuscandoClientes(true);
        BuscarClientesParaContratante(buscaCliente)
          .then((res) => {
            if (res.success) setClientesEncontrados(res.data);
          })
          .finally(() => setBuscandoClientes(false));
      } else {
        setClientesEncontrados([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [buscaCliente, clienteSelecionado]);

  function selecionarCliente(cliente: ClienteResumo) {
    setClienteSelecionado(cliente);
    setBuscaCliente("");
    setClientesEncontrados([]);
  }

  function handleEmpresaCriada(empresa: EmpresaContratadaResumo) {
    setEmpresasContratadas((prev) => [...prev, empresa].sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial)));
    setEmpresaContratadaId(empresa.id);
  }

  function handleGerar() {
    if (!titulo.trim()) {
      toast.error("Informe o título do documento");
      return;
    }
    if (!clienteSelecionado && !empresaContratadaId) {
      toast.error("Selecione ao menos o contratante ou a contratada antes de gerar", { duration: 4000 });
      return;
    }

    startTransition(async () => {
      const resultado = await GerarDocumento({
        templateId: template.id,
        titulo: titulo.trim(),
        variaveis: valores,
        clienteId: clienteSelecionado?.id,
        empresaContratadaId: empresaContratadaId ?? undefined,
      });
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Documento gerado");
      router.push(resultado.urlConferencia);
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <Link href={`/PainelAlpha/GeradorDocumentos/${template.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
        <ArrowLeft className="h-4 w-4" />
        Voltar ao template
      </Link>

      <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Gerar documento</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">A partir do template &ldquo;{template.titulo}&rdquo;</p>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="titulo-documento">Título do documento</Label>
          <Input id="titulo-documento" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>

        <section className="flex flex-col gap-1.5">
          <Label htmlFor="busca-contratante">Contratante (cliente)</Label>
          {clienteSelecionado ? (
            <div className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">{clienteSelecionado.razaoSocial}</p>
                {clienteSelecionado.nomeFantasia && (
                  <p className="truncate text-xs text-neutral-400">{clienteSelecionado.nomeFantasia}</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setClienteSelecionado(null)}>
                Trocar
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                id="busca-contratante"
                className="pl-8"
                placeholder="Buscar por razão social, nome fantasia ou CNPJ..."
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
              />
              {(clientesEncontrados.length > 0 || buscandoClientes) && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
                  {buscandoClientes ? (
                    <p className="px-3 py-2 text-xs text-neutral-400">Buscando...</p>
                  ) : (
                    clientesEncontrados.map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => selecionarCliente(cliente)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">{cliente.razaoSocial}</span>
                        {cliente.nomeFantasia && <span className="ml-1.5 text-xs text-neutral-400">{cliente.nomeFantasia}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-1.5">
          <Label htmlFor="select-contratada">Contratada (empresa)</Label>
          <div className="flex items-center gap-2">
            <Select value={empresaContratadaId ?? undefined} onValueChange={setEmpresaContratadaId}>
              <SelectTrigger id="select-contratada" className="flex-1">
                <SelectValue placeholder="Selecione a empresa contratada" />
              </SelectTrigger>
              <SelectContent>
                {empresasContratadas.map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id}>
                    {empresa.razaoSocial}
                    {empresa.nomeFantasia ? ` — ${empresa.nomeFantasia}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="secondary" size="sm" onClick={() => setModalEmpresaOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Nova
            </Button>
          </div>
        </section>

        {template.variaveis.map((variavel) => (
          <div key={variavel.nome} className="flex flex-col gap-1.5">
            <Label htmlFor={`var-${variavel.nome}`}>
              {variavel.label}
              {variavel.obrigatorio && <span className="ml-1 text-red-500">*</span>}
            </Label>
            {variavel.tipo === "booleano" ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`var-${variavel.nome}`}
                  checked={Boolean(valores[variavel.nome])}
                  onCheckedChange={(checked) => setValores((prev) => ({ ...prev, [variavel.nome]: Boolean(checked) }))}
                />
              </div>
            ) : (
              <Input
                id={`var-${variavel.nome}`}
                type={variavel.tipo === "data" ? "date" : variavel.tipo === "numero" || variavel.tipo === "moeda" ? "number" : "text"}
                placeholder={variavel.placeholder}
                value={typeof valores[variavel.nome] === "string" ? (valores[variavel.nome] as string) : ""}
                onChange={(e) => setValores((prev) => ({ ...prev, [variavel.nome]: e.target.value }))}
              />
            )}
          </div>
        ))}

        <Button onClick={handleGerar} disabled={isPending} className="mt-2">
          {isPending ? "Gerando..." : "Gerar documento"}
        </Button>
      </div>

      <ModalNovaEmpresaContratada open={modalEmpresaOpen} onOpenChange={setModalEmpresaOpen} onCriada={handleEmpresaCriada} />
    </div>
  );
}
