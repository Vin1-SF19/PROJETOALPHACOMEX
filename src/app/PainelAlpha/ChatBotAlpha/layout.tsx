import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { ChatbotShell } from "@/components/ChatBotAlpha/shell/ChatbotShell";
import { getTema } from "@/lib/temas";
import { isAdminRole } from "@/lib/roles";
import "@xyflow/react/dist/style.css";

export const dynamic = "force-dynamic";

export default async function ChatBotAlphaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/");
  const user = session.user as { id?: string; role?: string; tema_interface?: string };
  if (!isAdminRole(user.role ?? "")) {
    const permissions = user.id ? await getPermissoesEfetivas(Number(user.id)).catch(() => []) : [];
    if (!permissions.includes("chatBotAlpha")) redirect("/PainelAlpha");
  }
  return <ChatbotShell accent={getTema(user.tema_interface).accent}>{children}</ChatbotShell>;
}
