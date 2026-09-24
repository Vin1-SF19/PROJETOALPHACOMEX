import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";

type ClienteFormulario = Pick<typeof db, "bpmFormularioComponente"> | Pick<Prisma.TransactionClient, "bpmFormularioComponente">;

/** Retorna apenas campos efetivamente montados em formulários ativos das etapas. */
export async function camposPublicadosPorEtapa(
  etapaIds: string[],
  client: ClienteFormulario = db,
): Promise<Map<string, Set<string>>> {
  const componentes = await client.bpmFormularioComponente.findMany({
    where: {
      tipo: "CAMPO",
      campoId: { not: null },
      secao: { formulario: { ativo: true, etapaId: { in: etapaIds } } },
    },
    select: { campoId: true, secao: { select: { formulario: { select: { etapaId: true } } } } },
  });
  const porEtapa = new Map<string, Set<string>>();
  for (const componente of componentes) {
    if (!componente.campoId) continue;
    const etapaId = componente.secao.formulario.etapaId;
    const campos = porEtapa.get(etapaId) ?? new Set<string>();
    campos.add(componente.campoId);
    porEtapa.set(etapaId, campos);
  }
  return porEtapa;
}

/** Blocos especiais presentes no formulário e marcados para exigir preenchimento na saída. */
export async function capacidadesObrigatoriasPorEtapa(
  etapaIds: string[],
  client: ClienteFormulario = db,
): Promise<Map<string, Set<string>>> {
  const componentes = await client.bpmFormularioComponente.findMany({
    where: {
      tipo: { in: ["CAPABILITY", "CHECKLIST"] },
      capability: { not: null },
      secao: { formulario: { ativo: true, etapaId: { in: etapaIds } } },
    },
    select: { capability: true, configJson: true, secao: { select: { formulario: { select: { etapaId: true } } } } },
  });
  const porEtapa = new Map<string, Set<string>>();
  for (const componente of componentes) {
    if (!componente.capability) continue;
    let obrigatorio = true;
    if (componente.configJson) {
      try {
        const config = JSON.parse(componente.configJson) as { obrigatorioSaida?: unknown };
        obrigatorio = config.obrigatorioSaida !== false;
      } catch {
        obrigatorio = false;
      }
    }
    if (!obrigatorio) continue;
    const etapaId = componente.secao.formulario.etapaId;
    const capacidades = porEtapa.get(etapaId) ?? new Set<string>();
    capacidades.add(componente.capability);
    porEtapa.set(etapaId, capacidades);
  }
  return porEtapa;
}
