"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, Gauge, LayoutList, Save, ShieldCheck, UserRoundCheck, Volume2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ChatbotSettings } from "@/types/chatbot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { chatbotSettingsSchema } from "@/services/chatbot/schemas";

interface Props { settings: ChatbotSettings; isBusy: boolean; onUpdate: (settings: ChatbotSettings) => Promise<void> }
export function SettingsWorkspace({ settings, isBusy, onUpdate }: Props) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<ChatbotSettings>({ resolver: zodResolver(chatbotSettingsSchema), defaultValues: settings });
  const save = handleSubmit(async (values) => { try { await onUpdate(values); toast.success("Preferências atualizadas nesta sessão"); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar as preferências."); } });
  return <form onSubmit={save} aria-busy={isBusy} className="mx-auto max-w-4xl space-y-4 p-4 md:p-5" data-testid="chatbot-settings"><header><h2 className="text-lg font-semibold text-white">Configurações</h2><p className="text-sm text-slate-400">Preferências locais da experiência operacional do Chatbot Alpha.</p></header>
    <section className="rounded-xl border border-white/10 bg-slate-950/60"><div className="border-b border-white/10 p-4"><h3 className="font-medium text-white">Operação e disponibilidade</h3><p className="text-xs text-slate-500">Estas escolhas não alteram canais ou infraestrutura.</p></div><div className="divide-y divide-white/5 px-4">
      <Row icon={UserRoundCheck} title="Disponibilidade" description="Status visual usado na fila mock" error={errors.availability?.message}><Controller name="availability" control={control} render={({ field }) => <Select disabled={isBusy} value={field.value} onValueChange={field.onChange}><SelectTrigger aria-invalid={Boolean(errors.availability)} className="w-36 border-white/10 bg-slate-900"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="online">Online</SelectItem><SelectItem value="away">Ausente</SelectItem><SelectItem value="offline">Offline</SelectItem></SelectContent></Select>} /></Row>
      <Row icon={Gauge} title="Limite da fila" description="Quantidade visual máxima por atendente" error={errors.queueLimit?.message}><Input {...register("queueLimit", { valueAsNumber: true })} disabled={isBusy} aria-invalid={Boolean(errors.queueLimit)} type="number" min={1} max={100} className="w-28 border-white/10 bg-slate-900 text-white" /></Row>
      <Row icon={UserRoundCheck} title="Distribuição automática" description="Simula a atribuição de novas conversas"><Controller name="autoAssign" control={control} render={({ field }) => <Switch disabled={isBusy} checked={field.value} onCheckedChange={field.onChange} />} /></Row>
      <Row icon={LayoutList} title="Visão padrão" description="Filtro aplicado quando a Inbox é aberta" error={errors.defaultView?.message}><Controller name="defaultView" control={control} render={({ field }) => <Select disabled={isBusy} value={field.value} onValueChange={field.onChange}><SelectTrigger aria-invalid={Boolean(errors.defaultView)} className="w-36 border-white/10 bg-slate-900"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="mine">Minhas</SelectItem></SelectContent></Select>} /></Row>
    </div></section>
    <section className="rounded-xl border border-white/10 bg-slate-950/60"><div className="border-b border-white/10 p-4"><h3 className="font-medium text-white">Experiência</h3><p className="text-xs text-slate-500">Feedback e densidade da interface neste navegador.</p></div><div className="divide-y divide-white/5 px-4">
      <Row icon={Bell} title="Notificações desktop" description="Somente preferência visual; nenhuma permissão será solicitada"><Controller name="desktopNotifications" control={control} render={({ field }) => <Switch disabled={isBusy} checked={field.value} onCheckedChange={field.onChange} />} /></Row>
      <Row icon={Volume2} title="Som de novas mensagens" description="Não reproduz áudio nesta demonstração"><Controller name="sound" control={control} render={({ field }) => <Switch disabled={isBusy} checked={field.value} onCheckedChange={field.onChange} />} /></Row>
      <Row icon={LayoutList} title="Modo compacto" description="Prioriza densidade para rotinas operacionais"><Controller name="compactMode" control={control} render={({ field }) => <Switch disabled={isBusy} checked={field.value} onCheckedChange={field.onChange} />} /></Row>
    </div></section>
    <div className="flex flex-col gap-3 rounded-xl border border-indigo-400/20 bg-indigo-400/5 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-sm text-indigo-100"><ShieldCheck className="size-4" />Nenhum segredo ou configuração de backend é armazenado aqui.</p><Button type="submit" disabled={isBusy}><Save className="mr-2 size-4" />{isBusy ? "Salvando…" : "Salvar preferências"}</Button></div>
  </form>;
}
function Row({ icon: Icon, title, description, error, children }: { icon: typeof Bell; title: string; description: string; error?: string; children: React.ReactNode }) { return <div className="flex min-h-20 items-center gap-3 py-3"><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-indigo-300"><Icon className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-200">{title}</p><p className="text-xs text-slate-500">{description}</p>{error && <p role="alert" className="mt-1 text-xs text-rose-300">{error}</p>}</div>{children}</div>; }
