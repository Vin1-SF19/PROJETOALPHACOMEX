import { auth } from '../../../../auth'
import CadastroUsuarios from "@/components/FormCadastro";
import { redirect } from 'next/navigation';
import { getPermissoesEfetivas } from '@/actions/PermissoesSetor';
import { getSetoresParaSelect } from '@/actions/gestaoSetores';
import db from '@/lib/prisma';

const ROLES_GESTAO = ['Admin', 'CEO', 'RECURSOS HUMANOS', 'FINANCEIRO'];

export default async function CadastroPage() {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  const userId = Number(session?.user?.id);
  const sessionRole = (session?.user as { role?: string })?.role ?? '';

  // Busca role do DB — evita role stale no JWT, com fallback seguro
  let role = sessionRole;
  try {
    if (userId > 0) {
      const dbUser = await db.usuarios.findUnique({ where: { id: userId }, select: { role: true } });
      if (dbUser?.role) role = dbUser.role;
    }
  } catch {
    // Se o DB falhar, usa role da sessão como fallback
  }

  const ROLES_GESTAO_ALL = [...ROLES_GESTAO, 'Lider Comercial'];
  if (!ROLES_GESTAO_ALL.includes(role)) {
    let permissoes: string[] = [];
    try {
      permissoes = userId > 0 ? await getPermissoesEfetivas(userId) : [];
    } catch { /* fallback: sem permissões */ }
    if (!permissoes.includes("cadastro")) {
      redirect("/PainelAlpha");
    }
  }

  const setores = await getSetoresParaSelect().catch(() => []);

  return (
    <main className="text-alpha min-h-screen bg-[#020617] flex flex-col">
      <div className="text-alpha flex-1 w-full h-full flex flex-col overflow-hidden">
        <CadastroUsuarios currentUserRole={role} setores={setores} />
      </div>
    </main>
  );
}
