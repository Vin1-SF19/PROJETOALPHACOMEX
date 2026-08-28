"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CriarTemplateDocumento } from "@/actions/gerador-documentos";
import type { TipoVariavel } from "@/lib/gerador-documentos/schemas";
import type { TemplateResumo } from "./GeradorDocumentosClient";

const TIPOS_VARIAVEL_OPCOES: { value: TipoVariavel; label: string }[] = [
  { value: "texto", label: "Texto" },
  { value: "numero", label: "Número" },
  { value: "moeda", label: "Moeda (R$)" },
  { value: "data", label: "Data" },
  { value: "booleano", label: "Sim/Não" },
];

interface VariavelForm {
  nome: string;
  label: string;
  tipo: TipoVariavel;
  obrigatorio: boolean;
}

interface ClasulaForm {
  titulo: string;
  conteudo: string;
}

export function NovoTemplateDialog({
  open,
  onOpenChange,
  onCriado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriado: (template: TemplateResumo) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [variaveis, setVariaveis] = useState<VariavelForm[]>([]);
  const [clausulas, setClausulas] = useState<ClasulaForm[]>([{ titulo: "", conteudo: "" }]);
  const [isPending, startTransition] = useTransition();

  function resetar() {
    setTitulo("");
    setDescricao("");
    setCategoria("");
    setVariaveis([]);
    setClausulas([{ titulo: "", conteudo: "" }]);
  }

  function adicionarVariavel() {
    setVariaveis((prev) => [...prev, { nome: "", label: "", tipo: "texto", obrigatorio: true }]);
  }

  function atualizarVariavel(index: number, campo: keyof VariavelForm, valor: string | boolean) {
    setVariaveis((prev) => prev.map((v, i) => (i === index ? { ...v, [campo]: valor } : v)));
  }

  function removerVariavel(index: number) {
    setVariaveis((prev) => prev.filter((_, i) => i !== index));
  }

  function adicionarClasula() {
    setClausulas((prev) => [...prev, { titulo: "", conteudo: "" }]);
  }

  function atualizarClasula(index: number, campo: keyof ClasulaForm, valor: string) {
    setClausulas((prev) => prev.map((c, i) => (i === index ? { ...c, [campo]: valor } : c)));
  }

  function removerClasula(index: number) {
    setClausulas((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSalvar() {
    if (!titulo.trim()) {
      toast.error("Informe o título do template");
      return;
    }
    if (clausulas.some((c) => !c.titulo.trim() || !c.conteudo.trim())) {
      toast.error("Todas as cláusulas precisam de título e conteúdo");
      return;
    }
    if (variaveis.some((v) => !v.nome.trim() || !v.label.trim())) {
      toast.error("Todas as variáveis precisam de nome e rótulo");
      return;
    }

    startTransition(async () => {
      const resultado = await CriarTemplateDocumento({
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        categoria: categoria.trim() || undefined,
        variaveis: variaveis.map((v) => ({ ...v, placeholder: "" })),
        clausulas: clausulas.map((c) => ({ titulo: c.titulo.trim(), conteudo: c.conteudo.trim(), tipo: "TEXTO" as const, editavel: true })),
      });

      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }

      toast.success("Template criado");
      onCriado({
        id: resultado.templateId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        categoria: categoria.trim() || null,
        status: "ATIVO",
        criadoEm: new Date().toISOString(),
        criadoPor: { id: 0, nome: "" },
        _count: { clausulas: clausulas.length, documentos: 0 },
      });
      resetar();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo template de documento</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="titulo-template">Título</Label>
              <Input id="titulo-template" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Contrato de Prestação de Serviços" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="descricao-template">Descrição</Label>
              <Input id="descricao-template" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categoria-template">Categoria</Label>
              <Input id="categoria-template" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex: contrato, proposta" />
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Variáveis</h4>
              <Button type="button" variant="ghost" size="sm" onClick={adicionarVariavel}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Adicionar variável
              </Button>
            </div>
            {variaveis.length === 0 && (
              <p className="text-xs text-neutral-400">
                Nenhuma variável ainda. Use <code>{"{{nome_da_variavel}}"}</code> no texto das cláusulas.
              </p>
            )}
            {variaveis.map((variavel, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-neutral-200 p-3 sm:grid-cols-[1fr_1fr_140px_auto_auto] sm:items-center dark:border-neutral-800">
                <Input
                  placeholder="nome_variavel"
                  value={variavel.nome}
                  onChange={(e) => atualizarVariavel(index, "nome", e.target.value.replace(/\s+/g, "_"))}
                />
                <Input
                  placeholder="Rótulo exibido"
                  value={variavel.label}
                  onChange={(e) => atualizarVariavel(index, "label", e.target.value)}
                />
                <Select value={variavel.tipo} onValueChange={(v) => atualizarVariavel(index, "tipo", v)}>
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
                    id={`obrigatorio-${index}`}
                    checked={variavel.obrigatorio}
                    onCheckedChange={(checked) => atualizarVariavel(index, "obrigatorio", Boolean(checked))}
                  />
                  <Label htmlFor={`obrigatorio-${index}`} className="text-xs font-normal">
                    Obrigatória
                  </Label>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removerVariavel(index)} aria-label="Remover variável">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Cláusulas</h4>
              <Button type="button" variant="ghost" size="sm" onClick={adicionarClasula}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Adicionar cláusula
              </Button>
            </div>
            {clausulas.map((clasula, index) => (
              <div key={index} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={`Título da cláusula ${index + 1}`}
                    value={clasula.titulo}
                    onChange={(e) => atualizarClasula(index, "titulo", e.target.value)}
                  />
                  {clausulas.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removerClasula(index)} aria-label="Remover cláusula">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <textarea
                  className="min-h-24 w-full rounded-md border border-neutral-200 bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-800"
                  placeholder="Texto da cláusula, use {{variavel}} para inserir valores dinâmicos"
                  value={clasula.conteudo}
                  onChange={(e) => atualizarClasula(index, "conteudo", e.target.value)}
                />
              </div>
            ))}
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={isPending}>
            {isPending ? "Salvando..." : "Criar template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
