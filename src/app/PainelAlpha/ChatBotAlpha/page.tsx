import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { isAdminRole } from "@/lib/roles";
import { ObterUrlSistemaChatBot } from "@/actions/ChatBotAlpha";
import ChatBotAlphaClient from "@/components/ChatBotAlpha/ChatBotAlphaClient";

export const dynamic = "force-dynamic";

export default async function ChatBotAlphaPage() {
  const session = await auth();
  if (!session) redirect("/");

  const userId = Number((session.user as { id?: string }).id ?? 0);
  const role = (session.user as { role?: string }).role ?? "";
  const isAdmin = isAdminRole(role);

  if (!isAdmin) {
    let permissoes: string[] = [];
    try {
      permissoes = userId > 0 ? await getPermissoesEfetivas(userId) : [];
    } catch { /* fallback sem permissões */ }

    if (!permissoes.includes("chatBotAlpha")) {
      redirect("/PainelAlpha");
    }
  }

  // Usuário comum não vê tela de escolha — resolve a URL do MailHog aqui mesmo,
  // no server, evitando um useEffect de fetch-on-mount no client para o caso comum.
  const mailhogInicial = isAdmin ? null : await ObterUrlSistemaChatBot("mailhog");

  return (
    <main className="flex flex-col h-screen bg-[#020617] overflow-hidden">
      <ChatBotAlphaClient isAdmin={isAdmin} urlInicial={mailhogInicial} />
    </main>
  );
}
