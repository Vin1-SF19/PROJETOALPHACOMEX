"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, FileText, Trash2, Plus, Braces, Loader2 } from "lucide-react";

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
  const [salvandoClausulas, setSalvandoClausulas] = useState<Set<string>>(() => new Set());
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
    if (!clasula || salvandoClausulas.has(clasulaId)) return;
    setSalvandoClausulas((atual) => new Set(atual).add(clasulaId));
    startTransition(async () => {
      try {
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
      } finally {
        setSalvandoClausulas((atual) => {
          const proximas = new Set(atual);
          proximas.delete(clasulaId);
          return proximas;
        });
      }
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
    <main className="gd-main gd-inner mx-auto max-w-6xl px-4 py-8 md:px-8">
      <nav aria-label="Caminho" className="gd-breadcrumb mb-6">
        <Link href="/PainelAlpha/GeradorDocumentos">Gerador de Documentos</Link><span>/</span><span>Templates</span><span>/</span><span aria-current="page">{template.titulo}</span>
      </nav>
      <Link href="/PainelAlpha/GeradorDocumentos" className="gd-back mb-5 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div className="gd-page-heading mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="gd-kicker">Editor de template</p>
          <h1 className="gd-title">{template.titulo}</h1>
          {template.descricao && <p className="gd-muted mt-2 text-sm">{template.descricao}</p>}
        </div>
        {template.status === "ATIVO" && (
          <Link href={`/PainelAlpha/GeradorDocumentos/gerar?templateId=${template.id}`}>
            <Button><FileText className="mr-2 h-4 w-4" />Gerar documento</Button>
          </Link>
        )}
      </div>
      <div className="gd-editor-layout">
        <aside className="gd-panel gd-editor-nav p-4" aria-label="Seções do template">
          <p className="gd-kicker mb-4">Neste template</p>
          <a href="#variaveis-template" className="gd-editor-nav-link"><Braces className="h-4 w-4" /> Variáveis <span>{variaveis.length}</span></a>
          <a href="#clausulas-template" className="gd-editor-nav-link"><FileText className="h-4 w-4" /> Cláusulas <span>{clausulas.length}</span></a>
        </aside>
        <div className="min-w-0">

      <section id="variaveis-template" className="gd-panel mb-6 flex flex-col gap-4 p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div><p className="gd-kicker">Conteúdo dinâmico</p><h2 className="gd-section-title">Variáveis <span className="gd-muted">({variaveis.length})</span></h2></div>
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
          <p className="gd-empty-inline">Nenhuma variável ainda. Adicione uma para preencher dados ao gerar um documento.</p>
        )}

        {variaveis.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {variaveis.map((variavel) => (
              <Badge key={variavel.nome} variant="secondary" className="gd-variable-chip flex items-center gap-1.5 pr-1">
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
          <div className="gd-subpanel grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_1fr_140px_auto_auto] sm:items-center">
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
              <SelectContent className="gd-popover">
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
                {isPendingVariaveis && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{isPendingVariaveis ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setNovaVariavel(null)} aria-label="Cancelar">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>

      <div id="clausulas-template" className="mb-4 flex items-center justify-between gap-3 scroll-mt-6">
        <div><p className="gd-kicker">Estrutura do documento</p><h2 className="gd-section-title">Cláusulas <span className="gd-muted">({clausulas.length})</span></h2></div>
        <Button variant="ghost" size="sm" onClick={handleAdicionar} disabled={isPending}>
          {isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
          {isPending ? "Aguarde..." : "Adicionar cláusula"}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {clausulas.length === 0 && <div className="gd-panel gd-empty-inline p-8 text-center">Nenhuma cláusula ainda. Adicione a primeira cláusula para montar este template.</div>}
        {clausulas.map((clasula) => (
          <Card key={clasula.id} className="gd-clause-card flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <span className="gd-clause-index">{String(clasula.ordem + 1).padStart(2, "0")}</span>
              <input
                className="gd-clause-title min-w-0 flex-1 border-none bg-transparent text-sm font-medium outline-none"
                value={clasula.titulo}
                disabled={salvandoClausulas.has(clasula.id)}
                onChange={(e) => handleAtualizarCampo(clasula.id, "titulo", e.target.value)}
                onBlur={() => handleSalvarClasula(clasula.id)}
              />
              <Button variant="ghost" size="icon" onClick={() => handleRemover(clasula.id)} disabled={isPending} aria-label="Remover cláusula">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <textarea
              className="gd-textarea min-h-28 w-full rounded-md p-3 text-sm outline-none"
              value={clasula.conteudo}
              disabled={salvandoClausulas.has(clasula.id)}
              onChange={(e) => handleAtualizarCampo(clasula.id, "conteudo", e.target.value)}
              onBlur={() => handleSalvarClasula(clasula.id)}
            />
            {salvandoClausulas.has(clasula.id) && <p className="gd-muted flex items-center gap-2 text-xs" role="status"><Loader2 className="h-3 w-3 animate-spin" />Salvando cláusula...</p>}
          </Card>
        ))}
      </div>
        </div>
      </div>
    </main>
  );
}
