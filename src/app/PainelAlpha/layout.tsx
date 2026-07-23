import type { Metadata } from "next";
import "./style.css";
import { Toaster } from "sonner";
import { auth } from "../../../auth";
import PainelLayoutClient from "@/components/layout/PainelLayoutClient";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { getOnboardingVideo, type OnboardingVideo } from "@/lib/onboarding";
import db from "@/lib/prisma";
import { redirect } from "next/navigation";
import { statusPermiteAcessoPainel } from "@/lib/auth/acesso-painel";

export const metadata: Metadata = {
  title: "Painel Alpha",
};

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; nome?: string; name?: string; imagemUrl?: string } | undefined;

  const userId = Number(user?.id ?? 0);
  const role = user?.role ?? 'User';

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    redirect("/?acesso=bloqueado");
  }

  let permissoes: string[] = [];
  let temaName = "blue";
  let onboardingVisto = true;        // default true = não bloqueia se não houver usuário
  let onboardingVideo: OnboardingVideo | null = null;
  if (userId > 0) {
    const [perms, userRecord] = await Promise.all([
      getPermissoesEfetivas(userId),
      db.usuarios.findUnique({
        where: { id: userId },
        select: {
          status: true,
          tema_interface: true,
          onboarding_ialpha_visto: true,
        },
      }),
    ]);

    if (!userRecord || !statusPermiteAcessoPainel(userRecord.status)) {
      redirect("/?acesso=bloqueado");
    }

    permissoes = perms;
    temaName = userRecord?.tema_interface ?? "blue";
    onboardingVisto = userRecord?.onboarding_ialpha_visto ?? false;
    // Só busca o vídeo se ainda não viu (economiza query)
    if (!onboardingVisto) onboardingVideo = await getOnboardingVideo();
  }

  return (
    <div className="min-h-dvh bg-[#020617]">
      <Toaster richColors position="top-right" />
      <PainelLayoutClient
        permissoes={permissoes}
        role={role}
        nome={user?.nome ?? user?.name ?? "Operador"}
        imagemUrl={user?.imagemUrl ?? null}
        temaName={temaName}
        onboardingVisto={onboardingVisto}
        onboardingVideo={onboardingVideo}
      >
        {children}
      </PainelLayoutClient>
    </div>
  );
}
