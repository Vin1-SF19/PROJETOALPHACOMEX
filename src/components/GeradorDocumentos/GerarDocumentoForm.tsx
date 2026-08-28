"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { GerarDocumento } from "@/actions/gerador-documentos";
import type { VariavelTemplate } from "@/lib/gerador-documentos/schemas";

interface TemplateParaGeracao {
  id: string;
  titulo: string;
  variaveis: VariavelTemplate[];
}

export function GerarDocumentoForm({ template }: { template: TemplateParaGeracao }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(template.titulo);
  const [valores, setValores] = useState<Record<string, string | boolean>>({});
  const [isPending, startTransition] = useTransition();

  function handleGerar() {
    if (!titulo.trim()) {
      toast.error("Informe o título do documento");
      return;
    }

    startTransition(async () => {
      const resultado = await GerarDocumento({
        templateId: template.id,
        titulo: titulo.trim(),
        variaveis: valores,
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
    </div>
  );
}
