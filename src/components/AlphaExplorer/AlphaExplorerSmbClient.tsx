"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createSmbDirectory,
  getSmbLinkStatus,
  listSmbItems,
  loadSmbPreview,
  openSmbOfficeDocument,
  renameOrMoveSmbItem,
  restoreSmbItem,
  saveSmbDownload,
  trashSmbItem,
} from "@/lib/alpha-explorer/smb/browser-client";
import { friendlySmbErrorMessage } from "@/lib/alpha-explorer/smb/error-messages";
import { canPreviewInline, isOfficeTemporaryFile, MAX_INLINE_PREVIEW_BYTES, nativeOfficeApplication, previewMimeType } from "@/lib/alpha-explorer/file-preview";
import { ExplorerSidebar, type ExplorerCompanyFolder } from "./ExplorerSidebar";
import { ExplorerToolbar, type ExplorerSort } from "./ExplorerToolbar";
import { FileList, type ExplorerItemAction } from "./FileList";
import { FilePreviewDialog, type ExplorerFilePreview } from "./FilePreviewDialog";
import { SmbExplorerUpload } from "./SmbExplorerUpload";
import { SmbIdentityGate } from "./SmbIdentityGate";
import type { ExplorerItemView } from "./types";

const folderSchema = z.object({ name: z.string().trim().min(1, "Informe um nome").max(240) });
type FolderValues = z.infer<typeof folderSchema>;
interface Props { userId: number; admin: boolean; writeEnabled: boolean }
interface Crumb { handle: string; name: string }
type SmbListing = Awaited<ReturnType<typeof listSmbItems>>;
interface ActiveFilePreview extends ExplorerFilePreview { item: ExplorerItemView }

export function AlphaExplorerSmbClient(props: Props) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } }));
  return <QueryClientProvider client={client}><SmbIdentityBoundary {...props} /></QueryClientProvider>;
}

function SmbIdentityBoundary(props: Props) {
  const link = useQuery({ queryKey: ["alpha-explorer-smb", "link"], queryFn: ({ signal }) => getSmbLinkStatus(signal), retry: false });
  if (link.isLoading) return <div className="min-h-dvh bg-background p-8"><Skeleton className="mx-auto h-72 max-w-md" /></div>;
  if (link.isError) return <SmbFailure message={friendlySmbErrorMessage(link.error)} retry={() => void link.refetch()} admin={props.admin} />;
  if (!link.data) return <SmbIdentityGate admin={props.admin} onRetry={() => void link.refetch()} />;
  return <SmbWorkspace {...props} />;
}

function asItem(entry: Awaited<ReturnType<typeof listSmbItems>>["entries"][number], parentHandle: string): ExplorerItemView {
  const epoch = new Date(0).toISOString();
  return {
    id: entry.handle,
    kind: entry.kind === "directory" ? "FOLDER" : "FILE",
    name: entry.name,
    logicalPath: entry.handle,
    parentPath: parentHandle,
    provider: "smb",
    providerLabel: "NAS",
    sizeBytes: entry.size,
    validatedMime: null,
    status: "ACTIVE",
    version: 1,
    createdAt: epoch,
    updatedAt: entry.modifiedAt ?? epoch,
    deletedAt: null,
  };
}

function SmbWorkspace({ admin, writeEnabled }: Props) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ExplorerSort>("name");
  const [view, setView] = useState<"list" | "grid">("list");
  const [moving, setMoving] = useState<ExplorerItemView | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [preview, setPreview] = useState<ActiveFilePreview | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([""]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const form = useForm<FolderValues>({ resolver: zodResolver(folderSchema), defaultValues: { name: "" } });
  const currentHandle = crumbs.at(-1)?.handle ?? "root";
  const cursor = cursorHistory[cursorIndex] || undefined;

  const listing = useQuery<SmbListing>({
    queryKey: ["alpha-explorer-smb", "items", currentHandle, cursor],
    queryFn: ({ signal }) => listSmbItems(currentHandle, cursor, signal),
  });
  const roots = useQuery({
    queryKey: ["alpha-explorer-smb", "roots"],
    queryFn: ({ signal }) => listSmbItems("root", undefined, signal),
  });

  const items = useMemo<ExplorerItemView[]>(() => {
    if (!listing.data) return [];
    const mapped = listing.data.entries.map((entry) => asItem(entry, currentHandle));
    const term = query.toLocaleLowerCase("pt-BR");
    const filtered = term ? mapped.filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(term)) : mapped;
    return [...filtered].sort((left, right) => {
      if (sort === "size") return (left.sizeBytes ?? -1) - (right.sizeBytes ?? -1);
      if (sort === "createdAt") return left.updatedAt.localeCompare(right.updatedAt);
      return left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" });
    });
  }, [currentHandle, listing.data, query, sort]);

  const companyFolders = useMemo<ExplorerCompanyFolder[]>(() => roots.data?.entries
    .filter((entry) => entry.kind === "directory")
    .map((entry) => ({ name: entry.name, logicalPath: entry.handle })) ?? [], [roots.data]);

  function resetPagination() { setCursorHistory([""]); setCursorIndex(0); }
  function openRoot() { setCrumbs([]); resetPagination(); }
  function openHandle(handle: string) {
    if (handle === "root" || handle === "") { openRoot(); return; }
    const candidate = items.find((item) => item.id === handle) ?? roots.data?.entries.find((entry) => entry.handle === handle);
    if (!candidate) return;
    const name = "kind" in candidate && candidate.kind === "directory" ? candidate.name : candidate.name;
    const rootEntry = roots.data?.entries.some((entry) => entry.handle === handle);
    setCrumbs(rootEntry ? [{ handle, name }] : [...crumbs, { handle, name }]);
    resetPagination();
  }
  function navigateCrumb(path: string) {
    if (!path) { openRoot(); return; }
    const names = path.split("/");
    setCrumbs(crumbs.slice(0, names.length)); resetPagination();
  }

  async function createFolder(values: FolderValues) {
    try {
      await createSmbDirectory(currentHandle, values.name);
      form.reset(); setFolderOpen(false); toast.success("Pasta criada no NAS"); void listing.refetch();
    } catch (error) { toast.error(friendlySmbErrorMessage(error)); }
  }
  async function download(item: ExplorerItemView) {
    try { await saveSmbDownload(item.id, item.name); }
    catch (error) { toast.error(friendlySmbErrorMessage(error)); }
  }
  async function openFile(item: ExplorerItemView) {
    if (isOfficeTemporaryFile(item.name)) {
      toast.info("Este é um arquivo temporário criado pelo Microsoft Office. Abra a planilha ou o documento original, sem o prefixo ‘~$’.");
      void listing.refetch();
      return;
    }
    const officeApplication = nativeOfficeApplication(item.name);
    if (officeApplication) {
      try {
        toast.info(officeApplication === "word" ? "Abrindo no Microsoft Word…" : "Abrindo no Microsoft Excel…");
        await openSmbOfficeDocument({ handle: item.id, fileName: item.name, sizeBytes: item.sizeBytes });
      } catch (error) {
        toast.error(friendlySmbErrorMessage(error));
      }
      return;
    }
    const mimeType = previewMimeType(item.name);
    if (!mimeType || !canPreviewInline(item.name, item.sizeBytes)) {
      const supported = mimeType !== null;
      toast.info(supported
        ? `A visualização é limitada a ${MAX_INLINE_PREVIEW_BYTES / 1024 / 1024} MiB. Escolha onde salvar o arquivo.`
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
      const sourceUrl = await loadSmbPreview(item.id, item.name, controller.signal);
      if (controller.signal.aborted || previewAbortRef.current !== controller) { URL.revokeObjectURL(sourceUrl); return; }
      setPreview((current) => current?.item.id === item.id
        ? { ...current, sourceUrl, isLoading: false }
        : current);
    } catch (error) {
      if (controller.signal.aborted) return;
      setPreview((current) => current?.item.id === item.id
        ? { ...current, isLoading: false, error: friendlySmbErrorMessage(error) }
        : current);
    }
  }
  function closePreview() {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (preview?.sourceUrl) URL.revokeObjectURL(preview.sourceUrl);
    setPreview(null);
  }
  async function action(item: ExplorerItemView, operation: ExplorerItemAction) {
    if (operation === "move") { setMoving(item); toast.info("Abra a pasta de destino e confirme ‘Mover aqui’."); return; }
    try {
      if (operation === "rename") {
        const name = window.prompt("Novo nome", item.name)?.trim();
        if (!name) return;
        await renameOrMoveSmbItem({ scope: "rename", sourceHandle: item.id, destinationHandle: item.parentPath || "root", name });
      } else if (operation === "delete") {
        if (!window.confirm(`Mover “${item.name}” para a lixeira?`)) return;
        await trashSmbItem(item.id);
      } else {
        await restoreSmbItem(item.id);
      }
      toast.success(operation === "restore" ? "Item restaurado" : "Operação concluída"); void listing.refetch();
    } catch (error) { toast.error(friendlySmbErrorMessage(error)); }
  }
  async function moveHere() {
    if (!moving) return;
    try {
      await renameOrMoveSmbItem({ scope: "move", sourceHandle: moving.id, destinationHandle: currentHandle, name: moving.name });
      setMoving(null); toast.success("Arquivo movido"); void listing.refetch();
    } catch (error) { toast.error(friendlySmbErrorMessage(error)); }
  }

  const nextCursor = listing.data?.nextCursor ?? null;
  const nasOnline = !listing.isError && !roots.isError;
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#020916] text-[#F2F6FC]">
      <div className="hidden w-64 shrink-0 md:block"><ExplorerSidebar companyFolders={companyFolders} activePath={currentHandle} onSelectFolder={openHandle} nasOnline={nasOnline} /></div>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {moving && <div role="status" className="flex items-center justify-between gap-3 border-b bg-primary/10 px-5 py-2 text-sm"><span>Movendo “{moving.name}”</span><span className="flex gap-2"><Button size="sm" onClick={() => void moveHere()}>Mover aqui</Button><Button size="sm" variant="ghost" onClick={() => setMoving(null)}>Cancelar</Button></span></div>}
        {!writeEnabled && <div role="status" className="border-b border-amber-500/20 bg-amber-500/[0.06] px-5 py-2 text-[13px] text-amber-200/90">Modo leitura ativo.</div>}
        <ExplorerToolbar crumbs={crumbs.map((crumb) => crumb.name)} canGoUp={crumbs.length > 0} onGoUp={() => { setCrumbs(crumbs.slice(0, -1)); resetPagination(); }} onSelectCrumb={navigateCrumb} searchInput={searchInput} onSearchChange={setSearchInput} onSearchSubmit={() => setQuery(searchInput.trim())} sort={sort} onSortChange={setSort} admin={admin} view={view} onViewChange={setView} writeEnabled={writeEnabled} upload={<SmbExplorerUpload parentHandle={currentHandle} disabled={!writeEnabled} onComplete={() => void listing.refetch()} />} onNewFolder={() => setFolderOpen(true)} />
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {listing.isLoading && <div className="space-y-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>}
          {listing.isError && <SmbFailure message={friendlySmbErrorMessage(listing.error)} retry={() => void listing.refetch()} contained />}
          {listing.data && <FileList items={items} view={view} trash={false} selected={null} onSelect={() => undefined} onOpenFolder={openHandle} onOpenFile={(item) => void openFile(item)} onDownload={(item) => void download(item)} onAction={(item, nextAction) => void action(item, nextAction)} />}
          {(cursorIndex > 0 || nextCursor) && <nav className="mt-4 flex justify-end gap-2"><Button variant="outline" size="sm" disabled={cursorIndex === 0} onClick={() => setCursorIndex((value) => value - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={!nextCursor} onClick={() => { if (nextCursor) { setCursorHistory((values) => [...values.slice(0, cursorIndex + 1), nextCursor]); setCursorIndex((value) => value + 1); } }}>Próxima</Button></nav>}
        </div>
      </main>
      <FilePreviewDialog
        preview={preview}
        onClose={closePreview}
        onDownload={() => { if (preview) void download(preview.item); }}
        onRetry={() => { if (preview) void openFile(preview.item); }}
      />
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}><DialogContent><form onSubmit={form.handleSubmit(createFolder)}><DialogHeader><DialogTitle>Nova pasta</DialogTitle><DialogDescription>A pasta será criada no diretório atual do NAS.</DialogDescription></DialogHeader><div className="py-4"><label htmlFor="smb-folder-name" className="text-sm font-medium">Nome</label><Input id="smb-folder-name" autoFocus {...form.register("name")} /><p className="mt-1 text-xs text-destructive">{form.formState.errors.name?.message}</p></div><DialogFooter><Button type="button" variant="outline" onClick={() => setFolderOpen(false)}>Cancelar</Button><Button type="submit" disabled={form.formState.isSubmitting}>Criar pasta</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}

function SmbFailure({ message, retry, contained = false, admin = false }: { message: string; retry: () => void; contained?: boolean; admin?: boolean }) {
  return <div className={contained ? "grid min-h-64 place-items-center text-center" : "grid min-h-dvh place-items-center bg-background p-4 text-center"}><div><p className="font-medium">Não foi possível conectar ao Alpha Explorer SMB.</p><p className="my-3 text-sm text-muted-foreground">{message}</p><div className="flex flex-wrap justify-center gap-2"><Button onClick={retry}>Tentar novamente</Button>{admin && <Button asChild variant="outline"><Link href="/PainelAlpha/ExploradorArquivos/AdministracaoQnap">Administração QNAP</Link></Button>}</div></div></div>;
}
