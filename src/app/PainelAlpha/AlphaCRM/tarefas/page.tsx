import { getTema } from "@/lib/temas";
import { auth } from "../../../../../auth";
import { ListarTarefasGlobaisBpm } from "@/actions/bpm/Tarefas";
import TarefasCentralClient from "./TarefasCentralClient";

export const dynamic = "force-dynamic";

export default async function TarefasCentralPage() {
  const session = await auth();
  const temaNome = (session?.user as { tema_interface?: string })?.tema_interface || "blue";
  const visual = getTema(temaNome);

  const tarefasResult = await ListarTarefasGlobaisBpm();

  return (
    <TarefasCentralClient
      tarefas={tarefasResult.data ?? []}
      visual={visual}
      currentUserId={session?.user?.id ? Number(session.user.id) : null}
      currentUserRole={session?.user?.role ?? null}
    />
  );
}
