"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { GuiaModuloTour } from "@/components/Guias/GuiaModuloTour";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { marcarTutorialModuloComoVisto } from "@/lib/guias/tutorial-modulo";
import {
  createSmbDirectory,
  getSmbLinkStatus,
  listSmbItems,
  listSmbTrash,
  renameOrMoveSmbItem,
  restoreSmbItem,
  saveSmbDownload,
  trashSmbItem,
} from "@/lib/alpha-explorer/smb/browser-client";
import { friendlySmbErrorMessage } from "@/lib/alpha-explorer/smb/error-messages";
import { ExplorerHeader } from "./ExplorerHeader";
import { ExplorerSidebar, type ExplorerCompanyFolder, type ExplorerNavKey } from "./ExplorerSidebar";
import { ExplorerToolbar, type ExplorerSort } from "./ExplorerToolbar";
import { FileDetails } from "./FileDetails";
import { FileList, type ExplorerItemAction } from "./FileList";
import { SmbExplorerUpload } from "./SmbExplorerUpload";
import { SmbIdentityGate } from "./SmbIdentityGate";
import { ALPHA_EXPLORER_TUTORIAL } from "./tutorial";
import type { ExplorerItemView } from "./types";

const folderSchema = z.object({ name: z.string().trim().min(1, "Informe um nome").max(240) });
type FolderValues = z.infer<typeof folderSchema>;
interface Props { userId: number; admin: boolean; writeEnabled: boolean }
interface Crumb { handle: string; name: string }
type SmbListing = Awaited<ReturnType<typeof listSmbItems>> | Awaited<ReturnType<typeof listSmbTrash>>;

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

function SmbWorkspace({ userId, admin, writeEnabled }: Props) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [navKey, setNavKey] = useState<ExplorerNavKey>("meus");
  const [trash, setTrash] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ExplorerSort>("name");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<ExplorerItemView | null>(null);
  const [moving, setMoving] = useState<ExplorerItemView | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([""]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const form = useForm<FolderValues>({ resolver: zodResolver(folderSchema), defaultValues: { name: "" } });
  const currentHandle = crumbs.at(-1)?.handle ?? "root";
  const cursor = cursorHistory[cursorIndex] || undefined;

  const listing = useQuery<SmbListing>({
    queryKey: ["alpha-explorer-smb", trash ? "trash" : "items", currentHandle, cursor],
    queryFn: ({ signal }) => trash ? listSmbTrash(cursor, signal) : listSmbItems(currentHandle, cursor, signal),
  });
  const roots = useQuery({
    queryKey: ["alpha-explorer-smb", "roots"],
    queryFn: ({ signal }) => listSmbItems("root", undefined, signal),
  });

  const items = useMemo<ExplorerItemView[]>(() => {
    if (!listing.data) return [];
    const mapped = "entries" in listing.data
      ? listing.data.entries.map((entry) => asItem(entry, currentHandle))
      : listing.data.items.map((entry) => ({
        id: entry.trashHandle, kind: "FILE" as const, name: entry.name, logicalPath: entry.trashHandle,
        parentPath: "", provider: "smb", providerLabel: "NAS", sizeBytes: null, validatedMime: null,
        status: "TRASHED", version: 1, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), deletedAt: new Date(0).toISOString(),
      }));
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
  function openRoot() { setCrumbs([]); setTrash(false); setNavKey("meus"); setSelected(null); resetPagination(); }
  function openHandle(handle: string) {
    if (handle === "root" || handle === "") { openRoot(); return; }
    const candidate = items.find((item) => item.id === handle) ?? roots.data?.entries.find((entry) => entry.handle === handle);
    if (!candidate) return;
    const name = "kind" in candidate && candidate.kind === "directory" ? candidate.name : candidate.name;
    const rootEntry = roots.data?.entries.some((entry) => entry.handle === handle);
    setCrumbs(rootEntry ? [{ handle, name }] : [...crumbs, { handle, name }]);
    setTrash(false); setSelected(null); resetPagination();
  }
  function navigateCrumb(path: string) {
    if (!path) { openRoot(); return; }
    const names = path.split("/");
    setCrumbs(crumbs.slice(0, names.length)); setSelected(null); resetPagination();
  }
  function navigateSidebar(key: ExplorerNavKey) {
    if (key === "lixeira") { setTrash(true); setNavKey(key); setCrumbs([]); setSelected(null); resetPagination(); return; }
    openRoot(); setNavKey(key);
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
      setSelected(null); toast.success(operation === "restore" ? "Item restaurado" : "Operação concluída"); void listing.refetch();
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
      <div className="hidden w-64 shrink-0 md:block"><ExplorerSidebar navKey={navKey} onNavigate={navigateSidebar} companyFolders={companyFolders} activePath={trash ? "__trash__" : currentHandle} onSelectFolder={openHandle} nasOnline={nasOnline} /></div>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ExplorerHeader admin={admin} nasOnline={nasOnline} onOpenTour={() => setTourOpen(true)} />
        <div className="flex items-center justify-between gap-3 border-b px-5 py-2 text-xs text-muted-foreground">
          <span>Pastas liberadas pelas permissões da sua conta QNAP.</span>
        </div>
        {moving && <div role="status" className="flex items-center justify-between gap-3 border-b bg-primary/10 px-5 py-2 text-sm"><span>Movendo “{moving.name}”</span><span className="flex gap-2"><Button size="sm" onClick={() => void moveHere()}>Mover aqui</Button><Button size="sm" variant="ghost" onClick={() => setMoving(null)}>Cancelar</Button></span></div>}
        {!writeEnabled && <div role="status" className="border-b border-amber-500/20 bg-amber-500/[0.06] px-5 py-2 text-[13px] text-amber-200/90">Modo leitura ativo.</div>}
        <ExplorerToolbar crumbs={crumbs.map((crumb) => crumb.name)} canGoUp={crumbs.length > 0} onGoUp={() => { setCrumbs(crumbs.slice(0, -1)); resetPagination(); }} onSelectCrumb={navigateCrumb} searchInput={searchInput} onSearchChange={setSearchInput} onSearchSubmit={() => setQuery(searchInput.trim())} sort={sort} onSortChange={setSort} trash={trash} onToggleTrash={() => navigateSidebar(trash ? "meus" : "lixeira")} view={view} onViewChange={setView} writeEnabled={writeEnabled && !trash} upload={<SmbExplorerUpload parentHandle={currentHandle} disabled={!writeEnabled || trash} onComplete={() => void listing.refetch()} />} onNewFolder={() => setFolderOpen(true)} />
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {listing.isLoading && <div className="space-y-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>}
          {listing.isError && <SmbFailure message={friendlySmbErrorMessage(listing.error)} retry={() => void listing.refetch()} contained />}
          {listing.data && <FileList items={items} view={view} trash={trash} selected={selected} onSelect={setSelected} onOpenFolder={openHandle} onDownload={(item) => void download(item)} onAction={(item, nextAction) => void action(item, nextAction)} />}
          {(cursorIndex > 0 || nextCursor) && <nav className="mt-4 flex justify-end gap-2"><Button variant="outline" size="sm" disabled={cursorIndex === 0} onClick={() => setCursorIndex((value) => value - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={!nextCursor} onClick={() => { if (nextCursor) { setCursorHistory((values) => [...values.slice(0, cursorIndex + 1), nextCursor]); setCursorIndex((value) => value + 1); } }}>Próxima</Button></nav>}
        </div>
      </main>
      <FileDetails item={selected} trash={trash} admin={admin} onClose={() => setSelected(null)} onOpenFolder={openHandle} onDownload={(item) => void download(item)} onAction={(item, nextAction) => void action(item, nextAction)} />
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}><DialogContent><form onSubmit={form.handleSubmit(createFolder)}><DialogHeader><DialogTitle>Nova pasta</DialogTitle><DialogDescription>A pasta será criada no diretório atual do NAS.</DialogDescription></DialogHeader><div className="py-4"><label htmlFor="smb-folder-name" className="text-sm font-medium">Nome</label><Input id="smb-folder-name" autoFocus {...form.register("name")} /><p className="mt-1 text-xs text-destructive">{form.formState.errors.name?.message}</p></div><DialogFooter><Button type="button" variant="outline" onClick={() => setFolderOpen(false)}>Cancelar</Button><Button type="submit" disabled={form.formState.isSubmitting}>Criar pasta</Button></DialogFooter></form></DialogContent></Dialog>
      <GuiaModuloTour aberto={tourOpen} config={ALPHA_EXPLORER_TUTORIAL} accent="hsl(var(--primary))" onFinalizar={() => { marcarTutorialModuloComoVisto(window.localStorage, ALPHA_EXPLORER_TUTORIAL, userId); setTourOpen(false); }} />
    </div>
  );
}

function SmbFailure({ message, retry, contained = false, admin = false }: { message: string; retry: () => void; contained?: boolean; admin?: boolean }) {
  return <div className={contained ? "grid min-h-64 place-items-center text-center" : "grid min-h-dvh place-items-center bg-background p-4 text-center"}><div><p className="font-medium">Não foi possível conectar ao Alpha Explorer SMB.</p><p className="my-3 text-sm text-muted-foreground">{message}</p><div className="flex flex-wrap justify-center gap-2"><Button onClick={retry}>Tentar novamente</Button>{admin && <Button asChild variant="outline"><Link href="/PainelAlpha/ExploradorArquivos/AdministracaoQnap">Administração QNAP</Link></Button>}</div></div></div>;
}
