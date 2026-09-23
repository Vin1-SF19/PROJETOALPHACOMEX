import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getTema } from "@/lib/temas";
import SistemaPreAnaliseClient from "./SistemaPreAnaliseClient";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { isAdminRole } from "@/lib/roles";

export default async function SistemaPreAnalise() {
    const session = await auth();
    if (!session) redirect("/login");

    const role = (session.user as { role?: string })?.role;
    if (!isAdminRole(role)) {
        const userId = Number((session.user as { id?: string | number })?.id ?? 0);
        const permissoes = userId > 0 ? await getPermissoesEfetivas(userId) : [];
        if (!["analise", "radar", "Perse"].some(permissao => permissoes.includes(permissao))) {
            redirect("/PainelAlpha");
        }
    }

    const usuario = session.user as typeof session.user & { tema_interface?: string; nome?: string; role?: string };
    const temaNome = usuario?.tema_interface || "blue";
    const visual = getTema(temaNome);

    return (
        <SistemaPreAnaliseClient
            sessionUser={{
                nome: usuario?.nome ?? null,
                role: usuario?.role ?? null,
            }}
            visual={visual}
        />
    );
}
