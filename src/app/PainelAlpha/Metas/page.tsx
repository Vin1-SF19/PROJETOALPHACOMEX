import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getDadosMetas } from "@/actions/Metas";
import MetasClient from "./MetasClient";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function MetasPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const dados = await getDadosMetas();
    const agora = new Date();

    return (
        <MetasClient
            dadosIniciais={dados}
            isAdmin={isAdminRole(session.user.role) || session.user.role === "Lider Comercial"}
            mesAtual={agora.getMonth() + 1}
            anoAtual={agora.getFullYear()}
            role={session.user.role ?? ""}
            nomeUsuario={(session.user as { nome?: string }).nome ?? ""}
        />
    );
}
