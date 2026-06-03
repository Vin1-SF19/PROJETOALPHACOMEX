import { auth } from "../../../../auth";
import { getVideos, getUserProgresso } from "@/actions/GetVideos";
import { getAllCursos } from "@/actions/Cursos";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import AlphaSkillsClient from "./AlphaSkillsClient";

export default async function AlphaSkillsPage() {
    const session = await auth();
    const userId = session?.user?.id || "";

    const numericUserId = Number(userId);
    const [cursos, vids, progressRaw, permissoes] = await Promise.all([
        getAllCursos(),
        getVideos(),
        getUserProgresso(userId),
        numericUserId > 0 ? getPermissoesEfetivas(numericUserId) : Promise.resolve([] as string[]),
    ]);

    const podeGerenciar = permissoes.includes('skillsGerenciamento');

    const progress = (progressRaw || []).map((p: any) => ({
        aulaId: String(p.aulaId),
        concluido: Boolean(p.concluido)
    }));

    // Collect all unique modules across all courses
    const allModulosMap = new Map<string, any>();
    cursos.forEach(c =>
        c.modulos.forEach(m => {
            if (!allModulosMap.has(m.id)) allModulosMap.set(m.id, m);
        })
    );
    const allModulos = Array.from(allModulosMap.values());
    const allModulosOrdenados = [...allModulos].sort((a, b) => (a.ordemNoCurso || 0) - (b.ordemNoCurso || 0));

    // Process isLiberado globally
    const modulosProcessadosMap = new Map<string, any>();
    allModulos.forEach(mod => {
        if (!mod.bloqueado) {
            modulosProcessadosMap.set(mod.id, { ...mod, isLiberado: true });
            return;
        }

        let idRequisito = mod.requerModuloId;
        if (!idRequisito) {
            const idx = allModulosOrdenados.findIndex(m => m.id === mod.id);
            if (idx > 0) idRequisito = allModulosOrdenados[idx - 1].id;
        }

        if (!idRequisito) {
            modulosProcessadosMap.set(mod.id, { ...mod, isLiberado: true });
            return;
        }

        const aulasRequisito = vids.filter((v: any) =>
            v.modulo?.some((m: any) => String(m.id) === String(idRequisito))
        );
        const concluidas = progress.filter(p =>
            aulasRequisito.some((a: any) => String(a.id) === String(p.aulaId)) && p.concluido
        );
        const pct = aulasRequisito.length > 0 ? (concluidas.length / aulasRequisito.length) * 100 : 0;
        const meta = mod.percentualMinimo || 100;

        modulosProcessadosMap.set(mod.id, {
            ...mod,
            isLiberado: pct >= meta,
            nomeAnterior: allModulos.find(m => String(m.id) === String(idRequisito))?.nome
        });
    });

    // Rebuild courses with processed modules
    const cursosProcessados = cursos.map(curso => ({
        ...curso,
        modulos: curso.modulos.map(m => modulosProcessadosMap.get(m.id) || { ...m, isLiberado: true })
    }));

    return (
        <AlphaSkillsClient
            session={session}
            initialCursos={cursosProcessados}
            initialVideos={vids}
            podeGerenciar={podeGerenciar}
        />
    );
}
