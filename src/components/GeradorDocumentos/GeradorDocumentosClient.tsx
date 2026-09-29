"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Plus, FilePlus2, Archive, ExternalLink, Search, Download, ArrowRight, ArrowUpRight, Building2, CalendarDays, FolderOpen, Globe2, Layers3, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArquivarTemplateDocumento } from "@/actions/gerador-documentos";
import { filtrarDocumentosPorBusca } from "@/lib/gerador-documentos/busca";
import { NovoTemplateDialog } from "./NovoTemplateDialog";
import { CONTRATO_PADRAO_ID } from "@/lib/gerador-documentos/contrato-padrao-id";

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
  pdfDisponivel: boolean;
  criadoEm: Date | string;
  finalizadoEm: Date | string | null;
  template: { id: string; titulo: string };
  criadoPor: { id: number; nome: string };
  cliente: { id: number; razaoSocial: string; nomeFantasia: string | null } | null;
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
  const [arquivandoIds, setArquivandoIds] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();
  const [buscaDocumentoInput, setBuscaDocumentoInput] = useState("");
  const [buscaDocumento, setBuscaDocumento] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setBuscaDocumento(buscaDocumentoInput), 300);
    return () => clearTimeout(timer);
  }, [buscaDocumentoInput]);

  const documentosFiltrados = useMemo(
    () => filtrarDocumentosPorBusca(documentos, buscaDocumento),
    [documentos, buscaDocumento],
  );

  function handleArquivar(templateId: string) {
    if (arquivandoIds.has(templateId)) return;
    setArquivandoIds((atual) => new Set(atual).add(templateId));
    startTransition(async () => {
      try {
        const resultado = await ArquivarTemplateDocumento(templateId);
        if (!resultado.success) {
          toast.error(resultado.error);
          return;
        }
        setTemplates((prev) => prev.map((t) => (t.id === templateId ? { ...t, status: "ARQUIVADO" } : t)));
        toast.success("Template arquivado");
      } finally {
        setArquivandoIds((atual) => {
          const proximos = new Set(atual);
          proximos.delete(templateId);
          return proximos;
        });
      }
    });
  }

  const templatesAtivos = templates.filter((t) => t.status === "ATIVO");
  const templatesArquivados = templates.filter((t) => t.status === "ARQUIVADO");

  return (
    <main className="gd-main gd-home">
      <div className="gd-hero mb-8">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-2xl">
            <div className="mb-7 flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl border border-red-300/20 bg-red-400/10 text-red-300"><FileText size={24} /></span>
              <span className="gd-kicker">Alpha Comex <span className="mx-2 text-slate-600">/</span> Documentos</span>
            </div>
            <h1 className="gd-title gd-hero-title">Gerador de <span className="text-[#f77885]">Documentos</span></h1>
            <p className="gd-description mt-5 max-w-xl text-base text-slate-300">Templates contratuais com geração, conferência e reescrita por IA.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5"><Globe2 size={14} className="text-cyan-300/75" /> Comércio global</span>
              <span className="size-1 rounded-full bg-slate-600" aria-hidden="true" />
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-cyan-300/75" /> Gestão segura</span>
            </div>
          </div>
          <Button onClick={() => setNovoTemplateOpen(true)} className="min-h-11 rounded-xl px-5"><Plus size={17} /> Novo template</Button>
        </div>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="mb-6 flex h-auto w-full justify-start gap-7 overflow-x-auto rounded-none border-b border-white/10 bg-transparent p-0">
          <TabsTrigger value="templates" className="gd-tab"><Layers3 size={16} /> Templates <span className="text-xs text-slate-500">{templatesAtivos.length}</span></TabsTrigger>
          <TabsTrigger value="documentos" className="gd-tab"><FileText size={16} /> Documentos gerados <span className="text-xs text-slate-500">{documentos.length}</span></TabsTrigger>
          {templatesArquivados.length > 0 && (
            <TabsTrigger value="arquivados" className="gd-tab"><Archive size={16} /> Arquivados <span className="text-xs text-slate-500">{templatesArquivados.length}</span></TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="templates" className="mt-0">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div><h2 className="gd-section-title">Biblioteca de templates</h2><p className="gd-description mt-1">Modelos prontos para gerar documentos com os dados da sua operação.</p></div>
            <span className="hidden text-xs text-slate-500 sm:block">{templatesAtivos.length} ativos</span>
          </div>
          {templatesAtivos.length === 0 ? (
            <EstadoVazio
              titulo="Nenhum template criado"
              mensagem="Crie seu primeiro template para começar a gerar documentos."
              acao={<Button onClick={() => setNovoTemplateOpen(true)}><Plus size={16} /> Novo template</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {templatesAtivos.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onArquivar={() => handleArquivar(template.id)}
                  disabled={arquivandoIds.has(template.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documentos" className="mt-0">
          <div className="gd-page-head"><div><h2 className="gd-section-title text-xl">Documentos gerados</h2><p className="gd-description mt-1">Consulte, revise e gerencie os documentos criados.</p></div><span className="text-xs text-slate-500">{documentos.length} documentos</span></div>
          {documentos.length === 0 ? (
            <EstadoVazio titulo="Nenhum documento gerado" mensagem="Os documentos criados a partir dos templates aparecerão aqui." />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={buscaDocumentoInput}
                  onChange={(e) => setBuscaDocumentoInput(e.target.value)}
                  placeholder="Buscar documento, template ou cliente"
                  aria-label="Buscar documento"
                  className="h-11 pl-10"
                />
              </div>
              {documentosFiltrados.length === 0 ? (
                <EstadoVazio titulo="Nenhum resultado" mensagem={`Nenhum documento encontrado para “${buscaDocumento}”.`} />
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_110px_125px_96px] gap-4 px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 xl:grid"><span>Documento</span><span>Template</span><span>Cliente</span><span>Data</span><span>Status</span><span className="text-right">Ações</span></div>
                  {documentosFiltrados.map((documento) => (
                    <DocumentoRow key={documento.id} documento={documento} />
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {templatesArquivados.length > 0 && (
          <TabsContent value="arquivados" className="mt-0">
            <div className="mb-5"><h2 className="gd-section-title">Templates arquivados</h2><p className="gd-description mt-1">Modelos preservados para consulta.</p></div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {templatesArquivados.map((template) => (
                <TemplateCard key={template.id} template={template} disabled />
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <NovoTemplateDialog open={novoTemplateOpen} onOpenChange={setNovoTemplateOpen} onCriado={() => router.refresh()} />
    </main>
  );
}

function EstadoVazio({ titulo, mensagem, acao }: { titulo: string; mensagem: string; acao?: React.ReactNode }) {
  return (
    <div className="gd-empty flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl border border-red-300/20 bg-red-400/[.07] text-red-300"><FilePlus2 size={26} /></span>
      <h3 className="mt-2 text-lg font-semibold text-white">{titulo}</h3>
      <p className="gd-description max-w-sm">{mensagem}</p>
      {acao && <div className="mt-3">{acao}</div>}
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
    <Card className="gd-template-card flex min-h-72 flex-col gap-0 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl border border-red-300/20 bg-red-400/[.08] text-red-300"><FileText size={22} /></span>
        {template.id === CONTRATO_PADRAO_ID
          ? <Badge className="gd-standard rounded-full px-2.5 py-1 text-[11px]">★ Padrão para todos</Badge>
          : template.categoria && <Badge className="gd-status rounded-full px-2.5 py-1 text-[11px]">{template.categoria}</Badge>}
      </div>
      <h3 className="mt-6 line-clamp-2 min-h-12 text-lg font-semibold leading-6 tracking-tight text-white">{template.titulo}</h3>
      <p className="gd-description mt-2 line-clamp-2 min-h-10 text-sm">{template.descricao || "Modelo contratual disponível na biblioteca de documentos."}</p>
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-5 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5"><Layers3 size={13} /> {template._count.clausulas} cláusulas</span>
        <span className="inline-flex items-center gap-1.5"><FolderOpen size={13} /> {template._count.documentos} documentos</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {template.id !== CONTRATO_PADRAO_ID && (
          <Link href={`/PainelAlpha/GeradorDocumentos/${template.id}`} className="min-w-0 flex-1">
            <Button variant="secondary" className="w-full rounded-lg">Gerenciar <ArrowUpRight size={14} /></Button>
          </Link>
        )}
        {template.status === "ATIVO" && (
          <Link href={`/PainelAlpha/GeradorDocumentos/gerar?templateId=${template.id}`} className={template.id === CONTRATO_PADRAO_ID ? "flex-1" : ""}>
            <Button className="w-full rounded-lg">Gerar documento <ArrowRight size={14} /></Button>
          </Link>
        )}
        {onArquivar && template.id !== CONTRATO_PADRAO_ID && (
          <Button variant="ghost" size="icon" onClick={onArquivar} disabled={disabled} aria-label={`Arquivar template ${template.titulo}`} title="Arquivar template" className="rounded-lg">
            {disabled ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
          </Button>
        )}
      </div>
    </Card>
  );
}

function DocumentoRow({ documento }: { documento: DocumentoResumo }) {
  const nomeContratante = documento.cliente?.razaoSocial ?? documento.cliente?.nomeFantasia ?? "—";
  return (
    <Card className="gd-document-row grid min-w-0 gap-4 rounded-xl p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center xl:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_110px_125px_96px] xl:px-5">
      <div className="min-w-0">
        <p className="truncate font-semibold text-white">{documento.titulo}</p>
        <p className="mt-1 truncate text-xs text-slate-500 xl:hidden">{documento.template.titulo}</p>
      </div>
      <p className="hidden truncate text-sm text-slate-300 xl:block">{documento.template.titulo}</p>
      <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-slate-400 xl:text-sm"><Building2 size={14} className="shrink-0 text-slate-500 xl:hidden" /><span className="truncate">{nomeContratante}</span></p>
      <p className="flex items-center gap-1.5 text-xs text-slate-400"><CalendarDays size={14} className="xl:hidden" />{formatarData(documento.criadoEm)}</p>
      <Badge data-status={documento.status} className="gd-status w-fit rounded-full px-2.5 py-1 text-[11px]">
        {STATUS_DOCUMENTO_LABEL[documento.status] ?? documento.status}
      </Badge>
      <div className="flex items-center gap-1 sm:justify-end">{documento.pdfDisponivel && (
        <a href={`/PainelAlpha/GeradorDocumentos/${documento.id}/download`} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="icon" aria-label={`Baixar PDF de ${documento.titulo}`}>
            <Download className="h-4 w-4" />
          </Button>
        </a>
      )}
      <Link href={`/PainelAlpha/GeradorDocumentos/conferencia/${documento.tokenAcesso}`}>
        <Button variant="ghost" size="icon" aria-label={`Abrir conferência de ${documento.titulo}`}>
          <ExternalLink className="h-4 w-4" />
        </Button>
      </Link>
      </div>
    </Card>
  );
}
