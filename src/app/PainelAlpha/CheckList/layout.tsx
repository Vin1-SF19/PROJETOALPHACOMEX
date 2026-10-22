import { ChecklistProvider } from "@/components/checklist/ChecklistProvider";
import { obterAtorChecklist } from "@/lib/checklist/acesso";
import { auth } from "../../../../auth";
import db from "@/lib/prisma";
import { getTema } from "@/lib/temas";
import ChecklistBackground from "./ChecklistBackground";

export default async function CheckListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await obterAtorChecklist();
  const session = await auth();
  const userId = Number(session?.user?.id ?? 0);

  const userDb = userId
    ? await db.usuarios.findUnique({
        where: { id: userId },
        select: { tema_interface: true },
      })
    : null;

  const tema = getTema(userDb?.tema_interface ?? "blue");

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ "--checklist-accent": `rgb(${tema.accent})` } as React.CSSProperties}>
      {/* Fundo gerenciado aqui — vale para TODAS as páginas do CheckList */}
      <ChecklistBackground accentRgb={tema.accent} />

      {/* Conteúdo acima do fundo */}
      <div className="relative z-10">
        <ChecklistProvider>{children}</ChecklistProvider>
      </div>
    </div>
  );
}
