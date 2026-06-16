import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import MarketingClient from "./MarketingClient";

export const dynamic = "force-dynamic";

const ROLES_PERMITIDAS = ["Admin", "CEO"];
const iframeUrl = process.env.NEXT_PUBLIC_INSTAGRAM_STUDIO_URL ?? "http://192.168.35.113:3876";

export default async function MarketingPage() {
  const session = await auth();
  if (!session) redirect("/");

  const userId = Number((session.user as { id?: string }).id ?? 0);
  const role = (session.user as { role?: string }).role ?? "";

  if (!ROLES_PERMITIDAS.includes(role)) {
    let permissoes: string[] = [];
    try {
      permissoes = userId > 0 ? await getPermissoesEfetivas(userId) : [];
    } catch { /* fallback sem permissões */ }

    if (!permissoes.includes("instagramStudio")) {
      redirect("/PainelAlpha");
    }
  }

  return (
    <main className="flex flex-col h-screen bg-[#020617] overflow-hidden">
      <MarketingClient iframeUrl={iframeUrl} />
    </main>
  );
}
