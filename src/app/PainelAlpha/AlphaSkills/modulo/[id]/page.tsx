import { getModulos, getVideos, getUserProgresso } from "@/actions/GetVideos";
import ModuloDetalhesClient from "./ModuloDetalhesClient";
import { redirect, notFound } from "next/navigation";
import { auth } from "../../../../../../auth";


export default async function ModuloPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;

    const session = await auth();

    if (!session) {
        redirect("/");
    }

    const [mods, vids, progresso] = await Promise.all([
        getModulos(),
        getVideos(),
        getUserProgresso(session.user.id || "")
    ]);

    const moduloAtual = mods.find((m) => String(m.id) === String(id));

    if (!moduloAtual) notFound();

    if (moduloAtual?.bloqueado) {
        const todosModulosOrdenados = mods;
        const indexAtual = todosModulosOrdenados.findIndex((m) => m.id === moduloAtual.id);

        if (indexAtual > 0) {
            const moduloAnterior = todosModulosOrdenados[indexAtual - 1];

            const aulasAnt = vids.filter((v) => v.modulo?.some((m) => m.id === moduloAnterior.id));
            const concluidasAnt = progresso.filter((p) => aulasAnt.some(a => a.id === p.aulaId) && p.concluido);

            if (concluidasAnt.length < aulasAnt.length) {
                redirect("/PainelAlpha/AlphaSkills?msg=conclua-o-anterior");
            }
        }
    }


    const aulasDoModulo = vids
        .filter((v) => {
            return v.modulo.some((m) => String(m.id) === String(id));
        })
        .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));

    return (
        <ModuloDetalhesClient
            session={session}
            modulo={moduloAtual}
            aulasIniciais={aulasDoModulo}
            progressoInicial={progresso}
        />
    );
}
