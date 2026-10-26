import type { Metadata } from "next";
import "./style.css";
import { Toaster } from "sonner";
import { authComEstadoAcesso } from "../../../auth";
import { sessaoEstaIndisponivel } from "@/lib/auth/estado-acesso";
import { SessaoIndisponivel } from "@/components/auth/SessaoIndisponivel";
import PainelLayoutClient from "@/components/layout/PainelLayoutClient";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { getOnboardingVideo, type OnboardingVideo } from "@/lib/onboarding";
import db from "@/lib/prisma";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { statusPermiteAcessoPainel } from "@/lib/auth/acesso-painel";
import { lerDadosLayoutPainel } from "@/lib/painel-leituras-ssr";
import { ListarLinksExternosVisiveis, type LinkExternoVisivel } from "@/actions/LinksExternos";
import { PainelEmbeddedReady } from "@/components/layout/PainelEmbeddedReady";
import { PainelCardState } from "./AlphaCRM/CardModal/CardModalHost";
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
  const session = await authComEstadoAcesso();
  if (sessaoEstaIndisponivel(session)) return <SessaoIndisponivel />;
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
    let dados;
    try {
      dados = await lerDadosLayoutPainel({
        permissoes: () => getPermissoesEfetivas(userId),
        usuario: () => db.usuarios.findUnique({
          where: { id: userId },
          select: {
            status: true,
            role: true,
            tema_interface: true,
            onboarding_ialpha_visto: true,
          },
        }),
        links: ListarLinksExternosVisiveis,
        usuarioPermitido: (usuario) => statusPermiteAcessoPainel(usuario.status),
        onboarding: (usuario) => usuario.onboarding_ialpha_visto ? Promise.resolve(null) : getOnboardingVideo(),
      });
    } catch {
      return <SessaoIndisponivel />;
    }
    if (dados.estado === "NEGADO") {
      redirect("/?acesso=bloqueado");
    }
    if (dados.estado === "INDISPONIVEL") return <SessaoIndisponivel />;
    const { permissoes: perms, usuario: userRecord, links } = dados;

    permissoes = perms;
    role = userRecord.role;
    temaName = userRecord?.tema_interface ?? "blue";
    onboardingVisto = userRecord?.onboarding_ialpha_visto ?? false;
    linksExternos = links;
    onboardingVideo = dados.onboarding;
  }

  if (isEmbedded) {
    return (
      <div className="min-h-dvh bg-[#020617]" data-alpha-embedded="true">
        <PainelCardState key={userId} userId={userId}>{children}</PainelCardState>
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
        <PainelCardState key={userId} userId={userId}>{children}</PainelCardState>
      </PainelLayoutClient>
    </div>
  );
}
