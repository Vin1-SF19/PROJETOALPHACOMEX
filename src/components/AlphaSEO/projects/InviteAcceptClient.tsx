"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AceitarConviteProjetoAlphaSeo } from "@/actions/AlphaSeoProjects";
import { SeoCard } from "../shared/PageHeader";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function InviteAcceptClient({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function accept() {
    startTransition(async () => {
      const result = await AceitarConviteProjetoAlphaSeo({ token });
      if (!result.success) return setMessage(result.error);
      const projectId = record(result.data)?.projectId;
      if (typeof projectId !== "string") return setMessage("Convite aceito, mas o projeto não foi identificado.");
      router.replace(`/PainelAlpha/AlphaSEO/${projectId}/dashboard`);
      router.refresh();
    });
  }

  return <SeoCard className="mx-auto max-w-xl p-8 text-center"><ShieldCheck className="mx-auto text-[rgb(var(--seo-accent))]" size={32}/><h1 className="mt-4 text-2xl font-black text-white">Convite para o Alpha SEO</h1><p className="mt-3 text-sm leading-6 text-slate-400">A aceitação exige que você esteja autenticado com o mesmo e-mail convidado. O papel e o projeto são validados no servidor.</p><button type="button" onClick={accept} disabled={pending || token.length < 32} className="mt-6 min-h-11 rounded-xl bg-[rgb(var(--seo-accent))] px-5 text-sm font-black text-slate-950 disabled:opacity-40">{pending ? "Aceitando…" : "Aceitar convite"}</button>{message && <p role="alert" className="mt-4 text-sm text-rose-300">{message}</p>}</SeoCard>;
}
