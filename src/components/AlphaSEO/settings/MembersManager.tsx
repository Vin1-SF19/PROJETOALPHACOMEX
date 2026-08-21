"use client";

import { useState, useTransition } from "react";
import { Copy, Crown, Send, Trash2, UserCog } from "lucide-react";
import {
  AtualizarMembroProjetoAlphaSeo,
  ConvidarMembroProjetoAlphaSeo,
  RemoverMembroProjetoAlphaSeo,
  RevogarConviteProjetoAlphaSeo,
  TransferirPropriedadeProjetoAlphaSeo,
} from "@/actions/AlphaSeoProjects";
import { SeoCard } from "../shared/PageHeader";

interface MemberRow {
  id: string;
  userId: number;
  role: string;
  user: { nome: string; email: string };
}

interface InvitationRow { id: string; email: string; role: string; expiresAt: string | Date }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function MembersManager({ projectId, initialMembers, initialInvitations }: { projectId: string; initialMembers: MemberRow[]; initialInvitations: InvitationRow[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [inviteLink, setInviteLink] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function invite(formData: FormData) {
    startTransition(async () => {
      const result = await ConvidarMembroProjetoAlphaSeo({ projectId, email: formData.get("email"), role: formData.get("role"), expiresInHours: 72 });
      if (!result.success) return setMessage(result.error);
      const token = record(result.data)?.token;
      if (typeof token !== "string") return setMessage("Convite criado, mas o token seguro não foi retornado.");
      const link = `${window.location.origin}/PainelAlpha/AlphaSEO/invite?token=${encodeURIComponent(token)}`;
      setInviteLink(link);
      const invitation = record(result.data)?.invitation;
      const created = record(invitation);
      if (created && typeof created.id === "string" && typeof created.email === "string" && typeof created.role === "string") {
        const pendingInvite: InvitationRow = { id: created.id, email: created.email, role: created.role, expiresAt: String(created.expiresAt ?? "") };
        setInvitations((rows) => [pendingInvite, ...rows]);
      }
      setMessage("Convite criado. Copie o link agora; o token não será exibido novamente.");
    });
  }

  function revoke(invitationId: string) {
    startTransition(async () => {
      const result = await RevogarConviteProjetoAlphaSeo({ projectId, invitationId });
      if (!result.success) return setMessage(result.error);
      setInvitations((rows) => rows.filter((row) => row.id !== invitationId));
      setMessage("Convite revogado.");
    });
  }

  function updateRole(memberUserId: number, role: "EDITOR" | "VIEWER") {
    startTransition(async () => {
      const result = await AtualizarMembroProjetoAlphaSeo({ projectId, memberUserId, role });
      if (!result.success) return setMessage(result.error);
      setMembers((rows) => rows.map((row) => row.userId === memberUserId ? { ...row, role } : row));
      setMessage("Papel atualizado.");
    });
  }

  function remove(memberUserId: number) {
    startTransition(async () => {
      const result = await RemoverMembroProjetoAlphaSeo({ projectId, memberUserId });
      if (!result.success) return setMessage(result.error);
      setMembers((rows) => rows.filter((row) => row.userId !== memberUserId));
      setMessage("Membro removido.");
    });
  }

  function transfer(memberUserId: number) {
    startTransition(async () => {
      const result = await TransferirPropriedadeProjetoAlphaSeo({ projectId, newOwnerUserId: memberUserId, previousOwnerRole: "EDITOR" });
      if (!result.success) return setMessage(result.error);
      setMembers((rows) => rows.map((row) => row.userId === memberUserId ? { ...row, role: "OWNER" } : row.role === "OWNER" ? { ...row, role: "EDITOR" } : row));
      setMessage("Propriedade transferida. O proprietário anterior agora é editor.");
    });
  }

  return <SeoCard className="overflow-hidden">
    <div className="border-b border-white/5 p-5"><h2 className="font-bold text-white">Membros e convites</h2><form action={invite} className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_auto]"><label className="sr-only" htmlFor="alpha-seo-invite-email">E-mail</label><input id="alpha-seo-invite-email" name="email" type="email" required placeholder="pessoa@empresa.com" className="min-h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm"/><label className="sr-only" htmlFor="alpha-seo-invite-role">Papel</label><select id="alpha-seo-invite-role" name="role" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm"><option value="EDITOR">Editor</option><option value="VIEWER">Viewer</option></select><button disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-bold"><Send size={15}/>Convidar</button></form>{inviteLink && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3"><code className="block break-all text-xs text-amber-100">{inviteLink}</code><button type="button" onClick={() => navigator.clipboard.writeText(inviteLink)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-300 px-3 text-xs font-black text-amber-950"><Copy size={13}/>Copiar link</button></div>}</div>
    <div className="divide-y divide-white/[.04]">{members.map((member) => <div key={member.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{member.user.nome}</p><p className="truncate text-xs text-slate-500">{member.user.email}</p></div><div className="flex flex-wrap items-center gap-2">{member.role === "OWNER" ? <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-400/20 px-3 text-xs font-bold text-amber-200"><Crown size={13}/>Proprietário</span> : <><select aria-label={`Papel de ${member.user.nome}`} value={member.role} onChange={(event) => updateRole(member.userId, event.target.value as "EDITOR" | "VIEWER")} disabled={pending} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs"><option value="EDITOR">Editor</option><option value="VIEWER">Viewer</option></select><button type="button" onClick={() => transfer(member.userId)} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold"><UserCog size={13}/>Tornar owner</button><button type="button" onClick={() => remove(member.userId)} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-400/20 px-3 text-xs font-bold text-rose-300"><Trash2 size={13}/>Remover</button></>}</div></div>)}</div>
    {invitations.length > 0 && <div className="border-t border-white/5 p-4"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Convites pendentes</h3><div className="mt-3 space-y-2">{invitations.map((invitation) => <div key={invitation.id} className="flex flex-col gap-2 rounded-xl border border-white/5 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-white">{invitation.email}</p><p className="text-xs text-slate-500">{invitation.role} · expira {new Date(invitation.expiresAt).toLocaleString("pt-BR")}</p></div><button type="button" onClick={() => revoke(invitation.id)} disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-400/20 px-3 text-xs font-bold text-rose-300"><Trash2 size={13}/>Revogar</button></div>)}</div></div>}
    {message && <p role="status" className="border-t border-white/5 p-4 text-xs text-slate-400">{message}</p>}
  </SeoCard>;
}
