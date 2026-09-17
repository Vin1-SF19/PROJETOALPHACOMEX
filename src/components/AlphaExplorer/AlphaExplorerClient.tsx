"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { canPreviewInline, createPreviewObjectUrl, previewMimeType } from "@/lib/alpha-explorer/file-preview";
import { FilePreviewDialog, type ExplorerFilePreview } from "./FilePreviewDialog";
import { FileList, type ExplorerItemAction } from "./FileList";
import { ExplorerSidebar, type ExplorerCompanyFolder } from "./ExplorerSidebar";
import { ExplorerToolbar, type ExplorerSort } from "./ExplorerToolbar";
import { ExplorerUpload } from "./ExplorerUpload";
import { explorerFetch, explorerItemViewSchema, explorerListDataSchema, type ExplorerItemView } from "./types";

const folderFormSchema = z.object({ name: z.string().trim().min(1, "Informe um nome").max(240) });
type FolderForm = z.infer<typeof folderFormSchema>;
interface ActiveFilePreview extends ExplorerFilePreview { item: ExplorerItemView }

interface AlphaExplorerClientProps { userId: number; initialPath: string; admin: boolean; writeEnabled: boolean }

export function AlphaExplorerClient(props: AlphaExplorerClientProps) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1 } } }));
  return <QueryClientProvider client={client}><ExplorerWorkspace {...props} /></QueryClientProvider>;
}

function ExplorerWorkspace({ initialPath, admin, writeEnabled }: AlphaExplorerClientProps) {
  const [path, setPath] = useState(initialPath);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ExplorerSort>("name");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "grid">("list");
  const [folderOpen, setFolderOpen] = useState(false);
  const [preview, setPreview] = useState<ActiveFilePreview | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const form = useForm<FolderForm>({ resolver: zodResolver(folderFormSchema), defaultValues: { name: "" } });

  const params = new URLSearchParams({ path, query, sort, direction: "asc", page: String(page), limit: "50", trash: "false" });
  const listing = useQuery({ queryKey: ["alpha-explorer", path, query, sort, page], queryFn: () => explorerFetch(`/api/alpha-explorer/items?${params}`, explorerListDataSchema) });
  const refresh = useCallback(() => void listing.refetch(), [listing]);

  function navigate(nextPath: string) { setPath(nextPath); setPage(1); setQuery(""); setSearchInput(""); }

  function handleSelectFolder(logicalPath: string) {
    setPath(logicalPath);
    setPage(1);
    setQuery("");
    setSearchInput("");
  }

  const companyFolders = useMemo<ExplorerCompanyFolder[]>(() => {
    if (!listing.data) return [];
    return listing.data.items
      .filter((item) => item.id.startsWith("root:"))
      .map((item) => ({ name: item.name, logicalPath: item.logicalPath }));
  }, [listing.data]);

  const crumbs = path ? path.split("/") : [];
  const canGoUp = path !== initialPath;
  const nasOnline = !listing.isError;

  useEffect(() => {
    if (listing.isError) toast.error(listing.error.message);
  }, [listing.isError, listing.error]);

  async function createFolder(values: FolderForm) {
    try {
      await explorerFetch("/api/alpha-explorer/items", explorerItemViewSchema, { method: "POST", body: JSON.stringify({ path, name: values.name }) });
      toast.success("Pasta criada");
      setFolderOpen(false);
      form.reset();
      refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao criar pasta"); }
  }

  async function download(item: ExplorerItemView) {
    try {
      const data = await explorerFetch(`/api/alpha-explorer/items/${item.id}/download`, z.object({ url: z.string().url(), expiresInSeconds: z.number().nullable(), fileName: z.string() }), { method: "POST" });
      window.location.assign(data.url);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Download indisponível"); }
  }

  async function openFile(item: ExplorerItemView) {
    const mimeType = previewMimeType(item.name);
    if (!mimeType || !canPreviewInline(item.name, item.sizeBytes)) {
      toast.info(mimeType
        ? "Este arquivo é grande para visualizar no navegador e será baixado."
        : "Este formato será baixado para abrir no aplicativo correspondente.");
      await download(item);
      return;
    }
    previewAbortRef.current?.abort();
    if (preview?.sourceUrl) URL.revokeObjectURL(preview.sourceUrl);
    const controller = new AbortController();
    previewAbortRef.current = controller;
    setPreview({ item, fileName: item.name, sizeBytes: item.sizeBytes, mimeType, sourceUrl: null, isLoading: true, error: null });
    try {
      const data = await explorerFetch(`/api/alpha-explorer/items/${item.id}/download`, z.object({ url: z.string().url(), expiresInSeconds: z.number().nullable(), fileName: z.string() }), { method: "POST" });
      const response = await fetch(data.url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("O provedor não entregou o conteúdo para visualização.");
      const sourceUrl = await createPreviewObjectUrl(response, item.name);
      if (controller.signal.aborted || previewAbortRef.current !== controller) { URL.revokeObjectURL(sourceUrl); return; }
      setPreview((current) => current?.item.id === item.id
        ? { ...current, sourceUrl, isLoading: false }
        : current);
    } catch (error) {
      if (controller.signal.aborted) return;
      setPreview((current) => current?.item.id === item.id
        ? { ...current, isLoading: false, error: error instanceof Error ? error.message : "Visualização indisponível" }
        : current);
    }
  }
  function closePreview() {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (preview?.sourceUrl) URL.revokeObjectURL(preview.sourceUrl);
    setPreview(null);
  }

  async function itemAction(item: ExplorerItemView, action: ExplorerItemAction) {
    let body: Record<string, string | number> = { action, version: item.version };
    if (action === "rename") {
      const name = window.prompt("Novo nome", item.name)?.trim();
      if (!name) return;
      body = { ...body, name };
    } else if (action === "move") {
      const destinationPath = window.prompt("Pasta lógica de destino", item.parentPath)?.trim();
      if (destinationPath === undefined) return;
      body = { ...body, destinationPath };
    } else if (action === "delete" && !window.confirm(`Mover “${item.name}” para a lixeira?`)) return;
    try {
      await explorerFetch(`/api/alpha-explorer/items/${item.id}`, explorerItemViewSchema, { method: "PATCH", body: JSON.stringify(body) });
      toast.success(action === "restore" ? "Item restaurado" : "Operação concluída");
      refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Operação não concluída"); }
  }

  const uploadElement = (
    <ExplorerUpload
      path={path}
      disabled={!writeEnabled}
      onComplete={refresh}
      buttonClassName="rounded-xl bg-gradient-to-r from-[#1677FF] to-[#3B97FF] text-white shadow-[0_6px_20px_-8px_rgba(22,119,255,0.8)] hover:translate-y-[-1px]"
    />
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#020916] text-[#F2F6FC]">
      <div className="hidden w-64 shrink-0 md:block">
        <ExplorerSidebar
          companyFolders={companyFolders}
          activePath={path}
          onSelectFolder={handleSelectFolder}
          nasOnline={nasOnline}
        />
      </div>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {!writeEnabled && (
          <div role="status" className="border-b border-amber-500/20 bg-amber-500/[0.06] px-5 py-2 text-[13px] text-amber-200/90">
            Modo leitura ativo. A escrita será liberada somente após o smoke test operacional.
          </div>
        )}

        <ExplorerToolbar
          crumbs={crumbs}
          canGoUp={canGoUp}
          onGoUp={() => navigate(initialPath)}
          onSelectCrumb={navigate}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          onSearchSubmit={() => { setQuery(searchInput.trim()); setPage(1); }}
          sort={sort}
          onSortChange={setSort}
          admin={admin}
          view={view}
          onViewChange={setView}
          writeEnabled={writeEnabled}
          upload={uploadElement}
          onNewFolder={() => setFolderOpen(true)}
        />

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {listing.isLoading && (
            <div className="space-y-2" aria-label="Carregando arquivos">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full rounded-lg bg-[#07152B]" />)}
            </div>
          )}

          {listing.isError && (
            <div className="grid min-h-64 place-items-center text-center">
              <div>
                <p className="mb-1 text-sm font-medium text-[#F2F6FC]">Não foi possível conectar ao servidor de arquivos.</p>
                <p className="mb-4 text-[13px] text-[#8FA4C0]">{listing.error.message}</p>
                <Button onClick={() => void listing.refetch()} className="rounded-xl bg-gradient-to-r from-[#1677FF] to-[#3B97FF] text-white">
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}

          {listing.data && (
            <FileList
              items={listing.data.items}
              view={view}
              trash={false}
              selected={null}
              onSelect={() => undefined}
              onOpenFolder={navigate}
              onOpenFile={(item) => void openFile(item)}
              onDownload={(item) => void download(item)}
              onAction={(item, action) => void itemAction(item, action)}
            />
          )}

          {listing.data && listing.data.total > listing.data.limit && (
            <nav className="mt-4 flex items-center justify-end gap-2" aria-label="Paginação">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded-xl">
                Anterior
              </Button>
              <span className="text-[13px] text-[#8FA4C0]">Página {page}</span>
              <Button variant="outline" size="sm" disabled={page * listing.data.limit >= listing.data.total} onClick={() => setPage((current) => current + 1)} className="rounded-xl">
                Próxima
              </Button>
            </nav>
          )}
        </div>
      </main>

      <FilePreviewDialog
        preview={preview}
        onClose={closePreview}
        onDownload={() => { if (preview) void download(preview.item); }}
        onRetry={() => { if (preview) void openFile(preview.item); }}
      />

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="border-white/[0.08] bg-[#040D1D]">
          <form onSubmit={form.handleSubmit(createFolder)}>
            <DialogHeader>
              <DialogTitle>Nova pasta</DialogTitle>
              <DialogDescription>A pasta será criada em {path || "Arquivos"}.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium" htmlFor="folder-name">Nome</label>
              <Input id="folder-name" autoFocus {...form.register("name")} />
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.name?.message}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFolderOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>Criar pasta</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
