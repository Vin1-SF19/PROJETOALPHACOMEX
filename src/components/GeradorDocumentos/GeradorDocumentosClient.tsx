"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Plus, FilePlus2, Archive, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArquivarTemplateDocumento } from "@/actions/gerador-documentos";
import { NovoTemplateDialog } from "./NovoTemplateDialog";

export interface TemplateResumo {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  status: string;
  criadoEm: Date | string;
  criadoPor: { id: number; nome: string };
  _count: { clausulas: number; documentos: number };
}

export interface DocumentoResumo {
  id: string;
  titulo: string;
  status: string;
  tokenAcesso: string;
  criadoEm: Date | string;
  finalizadoEm: Date | string | null;
  template: { id: string; titulo: string };
  criadoPor: { id: number; nome: string };
}

const STATUS_DOCUMENTO_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  CONFERENCIA: "Em conferência",
  FINALIZADO: "Finalizado",
  ARQUIVADO: "Arquivado",
};

function formatarData(valor: Date | string): string {
  return new Date(valor).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function GeradorDocumentosClient({
  templatesIniciais,
  documentosIniciais,
}: {
  templatesIniciais: TemplateResumo[];
  documentosIniciais: DocumentoResumo[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(templatesIniciais);
  const [documentos] = useState(documentosIniciais);
  const [novoTemplateOpen, setNovoTemplateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleArquivar(templateId: string) {
    startTransition(async () => {
      const resultado = await ArquivarTemplateDocumento(templateId);
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      setTemplates((prev) => prev.map((t) => (t.id === templateId ? { ...t, status: "ARQUIVADO" } : t)));
      toast.success("Template arquivado");
    });
  }

  const templatesAtivos = templates.filter((t) => t.status === "ATIVO");
  const templatesArquivados = templates.filter((t) => t.status === "ARQUIVADO");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Gerador de Documentos</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Templates contratuais com geração, conferência e reescrita por IA.
            </p>
          </div>
        </div>
        <Button onClick={() => setNovoTemplateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo template
        </Button>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="templates">Templates ({templatesAtivos.length})</TabsTrigger>
          <TabsTrigger value="documentos">Documentos gerados ({documentos.length})</TabsTrigger>
          {templatesArquivados.length > 0 && (
            <TabsTrigger value="arquivados">Arquivados ({templatesArquivados.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          {templatesAtivos.length === 0 ? (
            <EstadoVazio
              mensagem="Nenhum template criado ainda."
              acao={<Button onClick={() => setNovoTemplateOpen(true)}>Criar o primeiro template</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templatesAtivos.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onArquivar={() => handleArquivar(template.id)}
                  disabled={isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documentos" className="mt-6">
          {documentos.length === 0 ? (
            <EstadoVazio mensagem="Nenhum documento gerado ainda." />
          ) : (
            <div className="flex flex-col gap-2">
              {documentos.map((documento) => (
                <DocumentoRow key={documento.id} documento={documento} />
              ))}
            </div>
          )}
        </TabsContent>

        {templatesArquivados.length > 0 && (
          <TabsContent value="arquivados" className="mt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templatesArquivados.map((template) => (
                <TemplateCard key={template.id} template={template} disabled />
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <NovoTemplateDialog open={novoTemplateOpen} onOpenChange={setNovoTemplateOpen} onCriado={() => router.refresh()} />
    </div>
  );
}

function EstadoVazio({ mensagem, acao }: { mensagem: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 py-16 text-neutral-400 dark:border-neutral-700">
      <FilePlus2 className="h-8 w-8" />
      <p>{mensagem}</p>
      {acao}
    </div>
  );
}

function TemplateCard({
  template,
  onArquivar,
  disabled,
}: {
  template: TemplateResumo;
  onArquivar?: () => void;
  disabled?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-neutral-900 dark:text-neutral-100">{template.titulo}</h3>
        {template.categoria && <Badge variant="secondary">{template.categoria}</Badge>}
      </div>
      {template.descricao && (
        <p className="line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">{template.descricao}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <span>{template._count.clausulas} cláusula(s)</span>
        <span>·</span>
        <span>{template._count.documentos} documento(s) gerado(s)</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Link href={`/PainelAlpha/GeradorDocumentos/${template.id}`} className="flex-1">
          <Button variant="secondary" className="w-full">
            Gerenciar
          </Button>
        </Link>
        {template.status === "ATIVO" && (
          <Link href={`/PainelAlpha/GeradorDocumentos/gerar?templateId=${template.id}`}>
            <Button>Gerar documento</Button>
          </Link>
        )}
        {onArquivar && (
          <Button variant="ghost" size="icon" onClick={onArquivar} disabled={disabled} aria-label="Arquivar template">
            <Archive className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function DocumentoRow({ documento }: { documento: DocumentoResumo }) {
  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">{documento.titulo}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {documento.template.titulo} · {formatarData(documento.criadoEm)}
        </p>
      </div>
      <Badge variant={documento.status === "FINALIZADO" ? "default" : "secondary"}>
        {STATUS_DOCUMENTO_LABEL[documento.status] ?? documento.status}
      </Badge>
      <Link href={`/PainelAlpha/GeradorDocumentos/conferencia/${documento.tokenAcesso}`}>
        <Button variant="ghost" size="icon" aria-label="Abrir conferência">
          <ExternalLink className="h-4 w-4" />
        </Button>
      </Link>
    </Card>
  );
}
