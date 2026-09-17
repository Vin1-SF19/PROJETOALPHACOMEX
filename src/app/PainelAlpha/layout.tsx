import type { Metadata } from "next";
import "./style.css";
import { Toaster } from "sonner";
import { auth } from "../../../auth";
import PainelLayoutClient from "@/components/layout/PainelLayoutClient";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { getOnboardingVideo, type OnboardingVideo } from "@/lib/onboarding";
import db from "@/lib/prisma";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { statusPermiteAcessoPainel } from "@/lib/auth/acesso-painel";
import { ListarLinksExternosVisiveis, type LinkExternoVisivel } from "@/actions/LinksExternos";
import { PainelEmbeddedReady } from "@/components/layout/PainelEmbeddedReady";
import {
  isValidPainelFrameId,
  PAINEL_EMBED_HEADER,
  PAINEL_FRAME_ID_HEADER,
} from "@/lib/painel-embedded";

export const metadata: Metadata = {
  title: "Painel Alpha",
};

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const isEmbedded = requestHeaders.get(PAINEL_EMBED_HEADER) === "1";
  const requestedFrameId = requestHeaders.get(PAINEL_FRAME_ID_HEADER);
  const frameId = isValidPainelFrameId(requestedFrameId) ? requestedFrameId : null;
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; nome?: string; name?: string; imagemUrl?: string } | undefined;

  const userId = Number(user?.id ?? 0);
  let role = user?.role ?? 'User';

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    redirect("/?acesso=bloqueado");
  }

  let permissoes: string[] = [];
  let temaName = "blue";
  let onboardingVisto = true;        // default true = não bloqueia se não houver usuário
  let onboardingVideo: OnboardingVideo | null = null;
  let linksExternos: LinkExternoVisivel[] = [];
  if (userId > 0) {
    const [perms, userRecord, links] = await Promise.all([
      getPermissoesEfetivas(userId),
      db.usuarios.findUnique({
        where: { id: userId },
        select: {
          status: true,
          role: true,
          tema_interface: true,
          onboarding_ialpha_visto: true,
        },
      }),
      ListarLinksExternosVisiveis(),
    ]);

    if (!userRecord || !statusPermiteAcessoPainel(userRecord.status)) {
      redirect("/?acesso=bloqueado");
    }

    permissoes = perms;
    role = userRecord.role;
    temaName = userRecord?.tema_interface ?? "blue";
    onboardingVisto = userRecord?.onboarding_ialpha_visto ?? false;
    linksExternos = links;
    // Só busca o vídeo se ainda não viu (economiza query)
    if (!onboardingVisto) onboardingVideo = await getOnboardingVideo();
  }

  if (isEmbedded) {
    return (
      <div className="min-h-dvh bg-[#020617]" data-alpha-embedded="true">
        {children}
        <PainelEmbeddedReady frameId={frameId} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#020617]">
      <Toaster richColors position="top-right" />
      <PainelLayoutClient
        permissoes={permissoes}
        role={role}
        userId={userId}
        nome={user?.nome ?? user?.name ?? "Operador"}
        imagemUrl={user?.imagemUrl ?? null}
        temaName={temaName}
        onboardingVisto={onboardingVisto}
        onboardingVideo={onboardingVideo}
        linksExternos={linksExternos}
      >
        {children}
      </PainelLayoutClient>
    </div>
  );
}
