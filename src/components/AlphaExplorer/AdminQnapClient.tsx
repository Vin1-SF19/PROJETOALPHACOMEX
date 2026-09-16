"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, RefreshCw, Search, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getSmbAdminCredentialStatus,
  listSmbAdminUsers,
  unlinkSmbAdminCredential,
  writeSmbAdminCredential,
  type SmbAdminUser,
} from "@/lib/alpha-explorer/smb/admin-browser-client";
import { friendlySmbErrorMessage } from "@/lib/alpha-explorer/smb/error-messages";

const credentialSchema = z.object({
  principal: z.string().trim().min(1, "Informe o usuário QNAP").max(128),
  password: z.string().min(1, "Informe a senha QNAP").max(512),
});
type CredentialValues = z.infer<typeof credentialSchema>;

function errorMessage(error: unknown): string {
  return friendlySmbErrorMessage(error);
}

export function AdminQnapClient() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1 } } }));
  return <QueryClientProvider client={client}><AdminQnapWorkspace /></QueryClientProvider>;
}

function AdminQnapWorkspace() {
  const [selected, setSelected] = useState<SmbAdminUser | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const users = useQuery({ queryKey: ["alpha-explorer-smb-admin", "users"], queryFn: ({ signal }) => listSmbAdminUsers(signal) });
  const status = useQuery({
    queryKey: ["alpha-explorer-smb-admin", "credential-status", selected?.id],
    queryFn: ({ signal }) => getSmbAdminCredentialStatus(selected!.id, signal),
    enabled: selected !== null,
    retry: false,
  });
  const form = useForm<CredentialValues>({
    resolver: zodResolver(credentialSchema),
    defaultValues: { principal: "", password: "" },
  });
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return users.data ?? [];
    return (users.data ?? []).filter((user) =>
      [user.nome, user.usuario, user.email, user.role].some((value) => value.toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [search, users.data]);

  function selectUser(user: SmbAdminUser) {
    setSelected(user);
    form.reset({ principal: "", password: "" });
  }

  async function submit(values: CredentialValues) {
    if (!selected) return;
    setBusy(true);
    try {
      await writeSmbAdminCredential({
        targetUserId: selected.id,
        mode: status.data?.linked ? "rotate" : "enroll",
        principal: status.data?.principal ?? values.principal,
        password: values.password,
      });
      form.reset({ principal: status.data?.principal ?? values.principal, password: "" });
      await status.refetch();
      toast.success(status.data?.linked ? "Credencial QNAP rotacionada" : "Conta QNAP vinculada");
    } catch (error) {
      form.resetField("password");
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (!selected || !status.data?.linked) return;
    if (!window.confirm(`Desvincular a conta QNAP de ${selected.nome}?`)) return;
    setBusy(true);
    try {
      await unlinkSmbAdminCredential({ targetUserId: selected.id });
      form.reset({ principal: "", password: "" });
      await status.refetch();
      toast.success("Conta QNAP desvinculada");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="size-5" /></span>
            <div><h1 className="font-semibold">Administração QNAP</h1><p className="text-sm text-muted-foreground">Vínculos seguros do Alpha Explorer</p></div>
          </div>
          <Button asChild variant="outline"><Link href="/PainelAlpha/ExploradorArquivos"><ArrowLeft className="mr-2 size-4" />Voltar ao Explorer</Link></Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <section className="overflow-hidden rounded-2xl border bg-card" aria-labelledby="users-heading">
          <div className="border-b p-4"><h2 id="users-heading" className="font-medium">Usuários do Painel Alpha</h2><p className="text-sm text-muted-foreground">Selecione quem receberá a identidade QNAP.</p></div>
          <div className="relative m-4"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Pesquisar usuários" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Nome, login, e-mail ou perfil" /></div>
          <div className="max-h-[65vh] overflow-y-auto px-2 pb-2">
            {users.isLoading && <div className="space-y-2 p-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>}
            {users.isError && <div className="p-4 text-sm text-destructive">{errorMessage(users.error)}</div>}
            {users.data && filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</div>}
            {filtered.map((user) => (
              <button key={user.id} type="button" onClick={() => selectUser(user)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected?.id === user.id ? "bg-primary/10" : "hover:bg-muted"}`}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted"><UserRound className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user.nome}</span><span className="block truncate text-xs text-muted-foreground">{user.usuario} · {user.role}</span></span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5" aria-labelledby="credential-heading">
          {!selected && <div className="grid min-h-80 place-items-center text-center text-muted-foreground"><div><KeyRound className="mx-auto mb-3 size-8" /><p>Selecione um usuário para administrar o vínculo.</p></div></div>}
          {selected && <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 id="credential-heading" className="font-medium">{selected.nome}</h2><p className="text-sm text-muted-foreground">{selected.email}</p></div>{status.isLoading ? <Skeleton className="h-6 w-24" /> : <Badge variant={status.data?.linked ? "default" : "secondary"}>{status.data?.linked ? "Vinculado" : "Sem vínculo"}</Badge>}</div>
            {status.isError && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{errorMessage(status.error)}<Button type="button" size="sm" variant="ghost" onClick={() => void status.refetch()}><RefreshCw className="mr-2 size-4" />Tentar novamente</Button></div>}
            {status.data && <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
              <div><label htmlFor="qnap-principal" className="text-sm font-medium">Usuário QNAP</label><Input id="qnap-principal" autoComplete="off" disabled={status.data.linked || busy} placeholder="Principal exato no QNAP" value={status.data.principal ?? undefined} {...(!status.data.linked ? form.register("principal") : {})} /><p className="mt-1 text-xs text-destructive">{form.formState.errors.principal?.message}</p></div>
              <div><label htmlFor="qnap-password" className="text-sm font-medium">{status.data.linked ? "Nova senha QNAP" : "Senha QNAP"}</label><Input id="qnap-password" type="password" autoComplete="new-password" disabled={busy} {...form.register("password")} /><p className="mt-1 text-xs text-destructive">{form.formState.errors.password?.message}</p></div>
              <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">A senha vai diretamente deste navegador para o gateway no servidor ialpha. Ela não é enviada ao Turso nem pode ser visualizada depois.</div>
              <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{busy ? "Validando…" : status.data.linked ? "Validar e rotacionar" : "Validar e vincular"}</Button>{status.data.linked && <Button type="button" variant="destructive" disabled={busy} onClick={() => void unlink()}>Desvincular</Button>}</div>
            </form>}
          </>}
        </section>
      </div>
    </main>
  );
}
