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

    const progress = (progressRaw || []).map((p) => ({
        aulaId: String(p.aulaId),
        concluido: Boolean(p.concluido)
    }));

    // Collect all unique modules across all courses
    type ModuloCurso = (typeof cursos)[number]["modulos"][number];
    const allModulosMap = new Map<string, ModuloCurso>();
    cursos.forEach(c =>
        c.modulos.forEach(m => {
            if (!allModulosMap.has(m.id)) allModulosMap.set(m.id, m);
        })
    );
    const allModulos = Array.from(allModulosMap.values());
    const allModulosOrdenados = [...allModulos].sort((a, b) => (a.ordemNoCurso || 0) - (b.ordemNoCurso || 0));

    // Process isLiberado globally
    const prepararModulo = (mod: ModuloCurso) => ({
        ...mod,
        imagemUrl: mod.imagemUrl ?? "",
        descricao: mod.descricao ?? undefined,
        aprendizado: mod.aprendizado ?? undefined,
    });
    type ModuloExibicao = ReturnType<typeof prepararModulo> & { isLiberado: boolean; nomeAnterior?: string };
    const modulosProcessadosMap = new Map<string, ModuloExibicao>();
    allModulos.forEach(mod => {
        if (!mod.bloqueado) {
            modulosProcessadosMap.set(mod.id, { ...prepararModulo(mod), isLiberado: true });
            return;
        }

        let idRequisito = mod.requerModuloId;
        if (!idRequisito) {
            const idx = allModulosOrdenados.findIndex(m => m.id === mod.id);
            if (idx > 0) idRequisito = allModulosOrdenados[idx - 1].id;
        }

        if (!idRequisito) {
            modulosProcessadosMap.set(mod.id, { ...prepararModulo(mod), isLiberado: true });
            return;
        }

        const aulasRequisito = vids.filter((v) =>
            v.modulo?.some((m) => String(m.id) === String(idRequisito))
        );
        const concluidas = progress.filter(p =>
            aulasRequisito.some((a) => String(a.id) === String(p.aulaId)) && p.concluido
        );
        const pct = aulasRequisito.length > 0 ? (concluidas.length / aulasRequisito.length) * 100 : 0;
        const meta = mod.percentualMinimo || 100;

        modulosProcessadosMap.set(mod.id, {
            ...prepararModulo(mod),
            isLiberado: pct >= meta,
            nomeAnterior: allModulos.find(m => String(m.id) === String(idRequisito))?.nome
        });
    });

    // Rebuild courses with processed modules
    const cursosProcessados = cursos.map(curso => ({
        ...curso,
        modulos: curso.modulos.map(m => modulosProcessadosMap.get(m.id) || { ...prepararModulo(m), isLiberado: true })
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
