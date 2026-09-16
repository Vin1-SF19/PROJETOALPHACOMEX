import { notFound, redirect } from "next/navigation";

import { auth } from "../../../../auth";
import { AlphaExplorerClient } from "@/components/AlphaExplorer/AlphaExplorerClient";
import { AlphaExplorerSmbClient } from "@/components/AlphaExplorer/AlphaExplorerSmbClient";
import { resolveExplorerAuthorization } from "@/lib/alpha-explorer/authorization";
import { userPrivatePrefix } from "@/lib/alpha-explorer/capabilities";
import { readExplorerRuntimeFlags } from "@/lib/alpha-explorer/runtime";
import { tryReadSmbRuntimeConfig } from "@/lib/alpha-explorer/smb/config";

export const dynamic = "force-dynamic";

export default async function ExploradorArquivosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const flags = readExplorerRuntimeFlags();
  if (!flags.enabled) notFound();

  const userId = Number(session.user.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) redirect("/PainelAlpha");
  const authorization = await resolveExplorerAuthorization(userId);
  if (!authorization.active || !authorization.moduleAllowed) redirect("/PainelAlpha");

  if (process.env.ALPHA_EXPLORER_SMB_ENABLED === "true") {
    const smb = tryReadSmbRuntimeConfig();
    if (smb.ok && smb.config.enabled) {
      return <AlphaExplorerSmbClient userId={userId} admin={authorization.admin} writeEnabled={flags.writeEnabled && smb.config.writeEnabled} />;
    }
  }

  return <AlphaExplorerClient userId={userId} admin={authorization.admin} writeEnabled={flags.writeEnabled} initialPath={authorization.admin ? "" : userPrivatePrefix(userId)} />;
}
