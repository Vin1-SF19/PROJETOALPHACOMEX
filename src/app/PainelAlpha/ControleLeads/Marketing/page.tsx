
import { redirect } from "next/navigation";
import { auth } from "../../../../../auth";
import { getPerformanceMarketing } from "@/actions/ComercialControle";
import { podeGerenciarMetas } from "@/lib/metas-permissoes";
import MarketingDashboard from "./dashboard";

export default async function MarketingPage({
    searchParams,
}: {
    searchParams: Promise<{ mes?: string; ano?: string }>;
}) {

    const session = await auth();
    const sParams = await searchParams;

    if (!session) redirect("/");
    if (!podeGerenciarMetas(session.user.role ?? "")) redirect("/PainelAlpha/ControleLeads");

    const agora = new Date();
    const mesInformado = Number(sParams?.mes ?? agora.getMonth());
    const anoInformado = Number(sParams?.ano ?? agora.getFullYear());
    const mes = Number.isInteger(mesInformado) && mesInformado >= 0 && mesInformado <= 11 ? mesInformado : agora.getMonth();
    const ano = Number.isInteger(anoInformado) && anoInformado >= 2000 && anoInformado <= 2100 ? anoInformado : agora.getFullYear();
    const referenciaAnterior = new Date(ano, mes - 1, 1);

    const [dadosEquipe, dadosEquipeAnterior] = await Promise.all([
        getPerformanceMarketing(mes, ano),
        getPerformanceMarketing(referenciaAnterior.getMonth(), referenciaAnterior.getFullYear()),
    ]);

    return (
        <MarketingDashboard
            dadosEquipe={dadosEquipe}
            dadosEquipeAnterior={dadosEquipeAnterior}
        />
    );
}
