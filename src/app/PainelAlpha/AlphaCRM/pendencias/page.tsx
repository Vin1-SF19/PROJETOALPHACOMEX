import { redirect } from "next/navigation";

import { auth } from "../../../../../auth";
import { ListarPendenciasBpm } from "@/actions/bpm/Pendencias";
import { PendenciasWorkspace } from "@/components/bpm/pendencias/PendenciasWorkspace";
import { getTema } from "@/lib/temas";

export const dynamic = "force-dynamic";

export default async function PendenciasBpmPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const resultado = await ListarPendenciasBpm();
  const temaNome = (session.user as { tema_interface?: string }).tema_interface || "blue";
  const visual = getTema(temaNome);

  return (
    <PendenciasWorkspace
      itens={resultado.data}
      erro={resultado.success ? null : resultado.error}
      accent={visual.accent}
    />
  );
}
