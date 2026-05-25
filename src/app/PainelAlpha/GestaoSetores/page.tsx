import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { getSetoresComContagem, getCargosComContagem } from "@/actions/gestaoSetores";
import GestaoSetoresClient from "@/components/GestaoSetores/GestaoSetoresClient";

const ROLES_PERMITIDAS = ["Admin", "CEO", "RECURSOS HUMANOS"];

export default async function GestaoSetoresPage() {
  const session = await auth();
  if (!session) redirect("/");

  const userId = Number(session?.user?.id);
  const sessionRole = (session?.user as { role?: string })?.role ?? "";

  let role = sessionRole;
  try {
    if (userId > 0) {
      const dbUser = await db.usuarios.findUnique({ where: { id: userId }, select: { role: true } });
      if (dbUser?.role) role = dbUser.role;
    }
  } catch { /* fallback */ }

  if (!ROLES_PERMITIDAS.includes(role)) {
    let permissoes: string[] = [];
    try {
      permissoes = userId > 0 ? await getPermissoesEfetivas(userId) : [];
    } catch { /* sem permissões */ }
    if (!permissoes.includes("gestaoSetores")) {
      redirect("/PainelAlpha");
    }
  }

  const [setores, cargos] = await Promise.all([
    getSetoresComContagem(),
    getCargosComContagem(),
  ]);

  return (
    <main className="text-alpha min-h-screen bg-[#020617] flex flex-col">
      <div className="text-alpha flex-1 w-full h-full flex flex-col overflow-hidden">
        <GestaoSetoresClient setoresIniciais={setores} cargosIniciais={cargos} />
      </div>
    </main>
  );
}
