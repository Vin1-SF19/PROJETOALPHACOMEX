"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, GripVertical, Trash2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CriarClasulaTemplate,
  AtualizarClasulaTemplate,
  RemoverClasulaTemplate,
} from "@/actions/gerador-documentos";
import type { VariavelTemplate } from "@/lib/gerador-documentos/schemas";

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
  const [isPending, startTransition] = useTransition();

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

      {template.variaveis.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {template.variaveis.map((variavel) => (
            <Badge key={variavel.nome} variant="secondary">
              {`{{${variavel.nome}}}`} — {variavel.label}
            </Badge>
          ))}
        </div>
      )}

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
