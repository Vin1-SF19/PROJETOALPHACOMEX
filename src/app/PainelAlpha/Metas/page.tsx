import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getDadosMetas } from "@/actions/Metas";
import MetasClient from "./MetasClient";

export const dynamic = "force-dynamic";

export default async function MetasPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const dados = await getDadosMetas();
    const agora = new Date();

    return (
        <MetasClient
            dadosIniciais={dados}
            isAdmin={session.user.role === "Admin" || session.user.role === "CEO" || session.user.role === "Lider Comercial"}
            mesAtual={agora.getMonth() + 1}
            anoAtual={agora.getFullYear()}
            role={session.user.role ?? ""}
            nomeUsuario={(session.user as { nome?: string }).nome ?? ""}
        />
    );
}
