"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Eye, History, Pencil, Search, UsersRound } from "lucide-react";
import { toast } from "sonner";
import type { Contact } from "@/types/chatbot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { contactFormSchema } from "@/services/chatbot/schemas";

interface Props { contacts: Contact[]; isBusy: boolean; onUpdate: (id: string, changes: Partial<Contact>) => Promise<void> | void }

export function ContactsWorkspace({ contacts, isBusy, onUpdate }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [editing, setEditing] = useState(false);
  const pageSize = 7;
  const filtered = useMemo(() => contacts.filter((contact) => {
    const term = search.toLocaleLowerCase("pt-BR");
    return (status === "all" || contact.status === status) && [contact.name, contact.email, contact.phone, contact.source].some((field) => field?.toLocaleLowerCase("pt-BR").includes(term));
  }), [contacts, search, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  function open(contact: Contact, edit = false) { setSelected(contact); setEditing(edit); }

  return (
    <div className="space-y-4 p-4 md:p-5" data-testid="chatbot-contacts">
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-3 md:flex-row md:items-center">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Pesquisar contatos</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar por nome, e-mail, telefone ou origem" className="border-white/10 bg-slate-900 pl-9 text-white" /></label>
        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger className="w-full border-white/10 bg-slate-900 text-white md:w-44"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="lead">Lead</SelectItem><SelectItem value="customer">Cliente</SelectItem><SelectItem value="blocked">Bloqueado</SelectItem></SelectContent></Select>
        <span className="text-xs text-slate-400">{filtered.length} contatos</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.025] text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Canais</th><th className="px-4 py-3">Tags</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Última interação</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {visible.map((contact) => <tr key={contact.id} className="text-slate-300 transition-colors hover:bg-white/[0.025]"><td className="px-4 py-3"><div className="font-medium text-white">{contact.name}</div><div className="text-xs text-slate-500">{contact.email || contact.phone}</div></td><td className="px-4 py-3 capitalize">{contact.channels.join(", ")}</td><td className="px-4 py-3"><div className="flex gap-1">{contact.tags.length ? contact.tags.map((tag) => <Badge key={tag.id} variant="secondary" className="bg-indigo-400/10 text-indigo-200">{tag.name}</Badge>) : <span className="text-slate-600">—</span>}</div></td><td className="px-4 py-3">{contact.assignee?.name || "Não atribuído"}</td><td className="px-4 py-3">{contact.source}</td><td className="px-4 py-3 text-xs">{new Date(contact.lastInteraction).toLocaleString("pt-BR")}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => open(contact)} aria-label={`Visualizar ${contact.name}`}><Eye className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => open(contact, true)} aria-label={`Editar ${contact.name}`}><Pencil className="size-4" /></Button></div></td></tr>)}
            </tbody>
          </table>
        </div>
        {!visible.length && <div className="grid place-items-center gap-2 px-4 py-16 text-center"><UsersRound className="size-8 text-slate-600" /><p className="font-medium text-slate-300">Nenhum contato encontrado</p><p className="text-xs text-slate-500">Ajuste a pesquisa ou os filtros.</p></div>}
        <footer className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-slate-400"><span>Página {Math.min(page, pages)} de {pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Próxima</Button></div></footer>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(openState) => { if (!openState && !isBusy) setSelected(null); }}><DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-xl"><DialogHeader><DialogTitle>{editing ? "Editar contato" : selected?.name}</DialogTitle><DialogDescription className="text-slate-400">Alterações são simuladas e ficam somente nesta sessão.</DialogDescription></DialogHeader>{selected && (editing ? <ContactEditForm contact={selected} isBusy={isBusy} onCancel={() => setEditing(false)} onSave={async (changes) => { await onUpdate(selected.id, changes); toast.success("Contato atualizado no ambiente de demonstração"); setEditing(false); setSelected(null); }} /> : <div className="space-y-4"><div className="grid grid-cols-2 gap-3 text-sm"><Info label="Telefone" value={selected.phone || "—"} /><Info label="E-mail" value={selected.email || "—"} /><Info label="Status" value={selected.status} /><Info label="Origem" value={selected.source} /></div><div><p className="mb-2 flex items-center gap-2 text-sm font-medium"><History className="size-4" />Histórico</p>{selected.history.map((item) => <div key={item.id} className="border-l border-indigo-400/40 py-1 pl-3"><p className="text-sm text-slate-200">{item.title}</p><p className="text-xs text-slate-500">{item.description} · {new Date(item.at).toLocaleString("pt-BR")}</p></div>)}</div><Button disabled={isBusy} onClick={() => setEditing(true)}><Pencil className="mr-2 size-4" />Editar contato</Button></div>)}</DialogContent></Dialog>
    </div>
  );
}

type ContactForm = z.infer<typeof contactFormSchema>;
function ContactEditForm({ contact, isBusy, onCancel, onSave }: { contact: Contact; isBusy: boolean; onCancel: () => void; onSave: (values: ContactForm) => Promise<void> }) {
  const { register, handleSubmit, formState: { errors } } = useForm<ContactForm>({ resolver: zodResolver(contactFormSchema), defaultValues: { name: contact.name, email: contact.email ?? "", phone: contact.phone ?? "", notes: contact.notes } });
  return <form onSubmit={handleSubmit(async (values) => { try { await onSave(values); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o contato."); } })} aria-busy={isBusy} className="space-y-3">
    <FormInput label="Nome" error={errors.name?.message}><Input {...register("name")} disabled={isBusy} maxLength={120} aria-invalid={Boolean(errors.name)} /></FormInput>
    <FormInput label="E-mail" error={errors.email?.message}><Input {...register("email")} disabled={isBusy} type="email" maxLength={254} aria-invalid={Boolean(errors.email)} /></FormInput>
    <FormInput label="Telefone" error={errors.phone?.message}><Input {...register("phone")} disabled={isBusy} maxLength={40} aria-invalid={Boolean(errors.phone)} /></FormInput>
    <FormInput label="Notas" error={errors.notes?.message}><textarea {...register("notes")} disabled={isBusy} maxLength={5000} aria-invalid={Boolean(errors.notes)} className="min-h-24 w-full rounded-md border border-white/10 bg-slate-900 p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400" /></FormInput>
    <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={isBusy} onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={isBusy}>{isBusy ? "Salvando…" : "Salvar alterações"}</Button></div>
  </form>;
}
function FormInput({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="block text-xs text-slate-400">{label}{children}{error && <span role="alert" className="mt-1 block text-rose-300">{error}</span>}</label>; }

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-white/[0.035] p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 capitalize text-slate-200">{value}</p></div>; }
