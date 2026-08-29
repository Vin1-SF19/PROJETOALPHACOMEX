"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, GripVertical, Trash2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CriarClasulaTemplate,
  AtualizarClasulaTemplate,
  RemoverClasulaTemplate,
  AtualizarTemplateDocumento,
} from "@/actions/gerador-documentos";
import type { TipoVariavel, VariavelTemplate } from "@/lib/gerador-documentos/schemas";

const TIPOS_VARIAVEL_OPCOES: { value: TipoVariavel; label: string }[] = [
  { value: "texto", label: "Texto" },
  { value: "numero", label: "Número" },
  { value: "moeda", label: "Moeda (R$)" },
  { value: "data", label: "Data" },
  { value: "booleano", label: "Sim/Não" },
];

const NOVA_VARIAVEL_VAZIA: VariavelTemplate = {
  nome: "",
  label: "",
  tipo: "texto",
  obrigatorio: true,
  placeholder: "",
};

interface Clasula {
  id: string;
  ordem: number;
  titulo: string;
  conteudo: string;
  tipo: string;
  editavel: boolean;
}

interface TemplateDetalhe {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  status: string;
  variaveis: VariavelTemplate[];
  clausulas: Clasula[];
}

export function TemplateDetalheClient({ template }: { template: TemplateDetalhe }) {
  const [clausulas, setClausulas] = useState(template.clausulas);
  const [variaveis, setVariaveis] = useState(template.variaveis);
  const [novaVariavel, setNovaVariavel] = useState<VariavelTemplate | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPendingVariaveis, startTransitionVariaveis] = useTransition();

  function salvarVariaveis(proximasVariaveis: VariavelTemplate[], aoSucesso?: () => void) {
    startTransitionVariaveis(async () => {
      const resultado = await AtualizarTemplateDocumento({
        templateId: template.id,
        variaveis: proximasVariaveis,
      });
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      setVariaveis(proximasVariaveis);
      toast.success("Variáveis atualizadas");
      aoSucesso?.();
    });
  }

  function handleAdicionarVariavel() {
    if (!novaVariavel) return;
    if (!novaVariavel.nome.trim() || !novaVariavel.label.trim()) {
      toast.error("Informe nome e rótulo da variável");
      return;
    }
    if (variaveis.some((v) => v.nome === novaVariavel.nome.trim())) {
      toast.error("Já existe uma variável com esse nome");
      return;
    }
    const proximas = [...variaveis, { ...novaVariavel, nome: novaVariavel.nome.trim(), label: novaVariavel.label.trim() }];
    salvarVariaveis(proximas, () => setNovaVariavel(null));
  }

  function handleRemoverVariavel(nome: string) {
    salvarVariaveis(variaveis.filter((v) => v.nome !== nome));
  }

  function handleAdicionar() {
    startTransition(async () => {
      const resultado = await CriarClasulaTemplate({
        templateId: template.id,
        ordem: clausulas.length,
        titulo: `Cláusula ${clausulas.length + 1}`,
        conteudo: "",
        tipo: "TEXTO",
        editavel: true,
      });
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      setClausulas((prev) => [...prev, resultado.data]);
    });
  }

  function handleAtualizarCampo(clasulaId: string, campo: "titulo" | "conteudo", valor: string) {
    setClausulas((prev) => prev.map((c) => (c.id === clasulaId ? { ...c, [campo]: valor } : c)));
  }

  function handleSalvarClasula(clasulaId: string) {
    const clasula = clausulas.find((c) => c.id === clasulaId);
    if (!clasula) return;
    startTransition(async () => {
      const resultado = await AtualizarClasulaTemplate({
        clasulaId,
        titulo: clasula.titulo,
        conteudo: clasula.conteudo,
      });
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Cláusula salva");
    });
  }

  function handleRemover(clasulaId: string) {
    startTransition(async () => {
      const resultado = await RemoverClasulaTemplate(clasulaId);
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      setClausulas((prev) => prev.filter((c) => c.id !== clasulaId));
      toast.success("Cláusula removida");
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <Link href="/PainelAlpha/GeradorDocumentos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{template.titulo}</h1>
          {template.descricao && <p className="text-sm text-neutral-500 dark:text-neutral-400">{template.descricao}</p>}
        </div>
        {template.status === "ATIVO" && (
          <Link href={`/PainelAlpha/GeradorDocumentos/gerar?templateId=${template.id}`}>
            <Button>Gerar documento</Button>
          </Link>
        )}
      </div>

      <section className="mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Variáveis ({variaveis.length})</h2>
          {!novaVariavel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNovaVariavel(NOVA_VARIAVEL_VAZIA)}
              disabled={isPendingVariaveis}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Adicionar variável
            </Button>
          )}
        </div>

        {variaveis.length === 0 && !novaVariavel && (
          <p className="text-xs text-neutral-400">Nenhuma variável ainda.</p>
        )}

        {variaveis.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {variaveis.map((variavel) => (
              <Badge key={variavel.nome} variant="secondary" className="flex items-center gap-1.5 pr-1">
                {`{{${variavel.nome}}}`} — {variavel.label}
                <button
                  type="button"
                  onClick={() => handleRemoverVariavel(variavel.nome)}
                  disabled={isPendingVariaveis}
                  aria-label={`Remover variável ${variavel.label}`}
                  className="rounded-full p-0.5 hover:bg-neutral-300/50 dark:hover:bg-neutral-700/50"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {novaVariavel && (
          <div className="grid grid-cols-1 gap-2 rounded-lg border border-neutral-200 p-3 sm:grid-cols-[1fr_1fr_140px_auto_auto] sm:items-center dark:border-neutral-800">
            <Input
              placeholder="nome_variavel"
              value={novaVariavel.nome}
              onChange={(e) => setNovaVariavel({ ...novaVariavel, nome: e.target.value.replace(/\s+/g, "_") })}
            />
            <Input
              placeholder="Rótulo exibido"
              value={novaVariavel.label}
              onChange={(e) => setNovaVariavel({ ...novaVariavel, label: e.target.value })}
            />
            <Select
              value={novaVariavel.tipo}
              onValueChange={(v) => setNovaVariavel({ ...novaVariavel, tipo: v as TipoVariavel })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_VARIAVEL_OPCOES.map((opcao) => (
                  <SelectItem key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="nova-variavel-obrigatoria"
                checked={novaVariavel.obrigatorio}
                onCheckedChange={(checked) => setNovaVariavel({ ...novaVariavel, obrigatorio: Boolean(checked) })}
              />
              <Label htmlFor="nova-variavel-obrigatoria" className="text-xs font-normal">
                Obrigatória
              </Label>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" onClick={handleAdicionarVariavel} disabled={isPendingVariaveis}>
                Salvar
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setNovaVariavel(null)} aria-label="Cancelar">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Cláusulas ({clausulas.length})</h2>
        <Button variant="ghost" size="sm" onClick={handleAdicionar} disabled={isPending}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Adicionar cláusula
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {clausulas.map((clasula) => (
          <Card key={clasula.id} className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-neutral-300" />
              <input
                className="flex-1 border-none bg-transparent text-sm font-medium outline-none"
                value={clasula.titulo}
                onChange={(e) => handleAtualizarCampo(clasula.id, "titulo", e.target.value)}
                onBlur={() => handleSalvarClasula(clasula.id)}
              />
              <Button variant="ghost" size="icon" onClick={() => handleRemover(clasula.id)} disabled={isPending} aria-label="Remover cláusula">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <textarea
              className="min-h-24 w-full rounded-md border border-neutral-200 bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-800"
              value={clasula.conteudo}
              onChange={(e) => handleAtualizarCampo(clasula.id, "conteudo", e.target.value)}
              onBlur={() => handleSalvarClasula(clasula.id)}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
