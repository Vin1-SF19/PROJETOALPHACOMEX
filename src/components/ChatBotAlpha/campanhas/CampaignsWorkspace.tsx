"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CalendarClock, Megaphone, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { Campaign, ChatbotChannel, MessageTemplate } from "@/types/chatbot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { campaignFormSchema } from "@/services/chatbot/schemas";

interface Props { campaigns: Campaign[]; templates: MessageTemplate[]; isBusy: boolean; onSave: (campaign: Campaign) => Promise<void> }
const channels: ChatbotChannel[] = ["whatsapp", "instagram", "messenger", "telegram", "email", "webchat"];

export function CampaignsWorkspace({ campaigns, templates, isBusy, onSave }: Props) {
  const [search, setSearch] = useState(""); const [editing, setEditing] = useState<Campaign | null>(null); const [creating, setCreating] = useState(false);
  const selected = editing ?? (creating ? emptyCampaign(templates[0]?.id, campaigns.length + 1) : null);
  const visible = useMemo(() => campaigns.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())), [campaigns, search]);
  return <div className="space-y-4 p-4 md:p-5" data-testid="chatbot-campaigns"><header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-lg font-semibold text-white">Campanhas</h2><p className="text-sm text-slate-400">Broadcasts simulados: público, template, canal e agendamento.</p></div><Button disabled={isBusy} onClick={() => setCreating(true)}><Plus className="mr-2 size-4" />Nova campanha</Button></header>
    <label className="relative block max-w-lg"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar campanhas" aria-label="Pesquisar campanhas" className="border-white/10 bg-slate-950/60 pl-9 text-white" /></label>
    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/60"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase text-slate-500"><tr><th className="p-4">Campanha</th><th className="p-4">Público</th><th className="p-4">Canal</th><th className="p-4">Agendamento</th><th className="p-4">Entrega</th><th className="p-4">Status</th><th className="p-4" /></tr></thead><tbody className="divide-y divide-white/5">{visible.map((item) => { const delivery = item.sent ? Math.round(item.delivered / item.sent * 100) : 0; return <tr key={item.id} className="text-slate-300 hover:bg-white/[0.025]"><td className="p-4 font-medium text-white"><span className="flex items-center gap-2"><Megaphone className="size-4 text-indigo-300" />{item.name}</span></td><td className="p-4">{item.audience}</td><td className="p-4 capitalize">{item.channel}</td><td className="p-4 text-xs">{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString("pt-BR") : "Não agendada"}</td><td className="p-4">{item.delivered}/{item.sent} <span className="text-xs text-slate-500">({delivery}%)</span></td><td className="p-4"><Status status={item.status} /></td><td className="p-4 text-right"><Button variant="ghost" size="icon" onClick={() => setEditing(item)} aria-label={`Editar ${item.name}`}><Pencil className="size-4" /></Button></td></tr>; })}</tbody></table></div>{!visible.length && <div className="p-12 text-center text-sm text-slate-500">Nenhuma campanha encontrada.</div>}</div>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !isBusy) { setCreating(false); setEditing(null); } }}><DialogContent className="border-white/10 bg-slate-950 text-white"><DialogHeader><DialogTitle>{creating ? "Nova campanha" : "Editar campanha"}</DialogTitle><DialogDescription className="text-slate-400">O agendamento é apenas visual e não cria jobs.</DialogDescription></DialogHeader>{selected && <CampaignFormPanel campaign={selected} templates={templates} isBusy={isBusy} onSave={async (campaign) => { await onSave(campaign); toast.success("Campanha salva sem disparar mensagens"); setCreating(false); setEditing(null); }} />}</DialogContent></Dialog>
  </div>;
}
function emptyCampaign(templateId = "", number = 1): Campaign { return { id: `campaign-new-${number}`, name: "", audience: "", templateId, channel: "whatsapp", status: "draft", sent: 0, delivered: 0 }; }
type CampaignForm = z.infer<typeof campaignFormSchema>;
function CampaignFormPanel({ campaign, templates, isBusy, onSave }: { campaign: Campaign; templates: MessageTemplate[]; isBusy: boolean; onSave: (campaign: Campaign) => Promise<void> }) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<CampaignForm>({ resolver: zodResolver(campaignFormSchema), defaultValues: { name: campaign.name, audience: campaign.audience, templateId: campaign.templateId, channel: campaign.channel, scheduledAt: campaign.scheduledAt?.slice(0, 16) ?? "" } });
  return <form onSubmit={handleSubmit(async (values) => { const scheduledAt = values.scheduledAt ? new Date(values.scheduledAt).toISOString() : undefined; try { await onSave({ ...campaign, ...values, scheduledAt, status: scheduledAt ? "scheduled" : "draft" }); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar a campanha."); } })} aria-busy={isBusy} className="space-y-3">
    <Field label="Nome" error={errors.name?.message}><Input {...register("name")} disabled={isBusy} maxLength={120} aria-invalid={Boolean(errors.name)} /></Field>
    <Field label="Público" error={errors.audience?.message}><Input {...register("audience")} disabled={isBusy} maxLength={500} aria-invalid={Boolean(errors.audience)} /></Field>
    <Field label="Template" error={errors.templateId?.message}><Controller name="templateId" control={control} render={({ field }) => <Select disabled={isBusy} value={field.value} onValueChange={field.onChange}><SelectTrigger aria-invalid={Boolean(errors.templateId)} className="mt-1 border-white/10 bg-slate-900"><SelectValue /></SelectTrigger><SelectContent>{templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent></Select>} /></Field>
    <Field label="Canal" error={errors.channel?.message}><Controller name="channel" control={control} render={({ field }) => <Select disabled={isBusy} value={field.value} onValueChange={field.onChange}><SelectTrigger aria-invalid={Boolean(errors.channel)} className="mt-1 border-white/10 bg-slate-900"><SelectValue /></SelectTrigger><SelectContent>{channels.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}</SelectContent></Select>} /></Field>
    <Field label="Agendar para" error={errors.scheduledAt?.message}><Input {...register("scheduledAt")} disabled={isBusy} type="datetime-local" aria-invalid={Boolean(errors.scheduledAt)} /></Field>
    <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200"><CalendarClock className="mr-2 inline size-4" />Nenhuma mensagem será enviada nesta etapa.</div><Button type="submit" disabled={isBusy} className="w-full">{isBusy ? "Salvando…" : "Salvar simulação"}</Button>
  </form>;
}
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="block text-xs text-slate-400">{label}{children}{error && <span role="alert" className="mt-1 block text-rose-300">{error}</span>}</label>; }
function Status({ status }: { status: Campaign["status"] }) { const color = status === "completed" ? "bg-emerald-400/10 text-emerald-300" : status === "scheduled" ? "bg-indigo-400/10 text-indigo-300" : "bg-slate-700 text-slate-300"; return <Badge className={color}>{status}</Badge>; }
