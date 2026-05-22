import { auth } from '../../../../auth'
import CadastroUsuarios from "@/components/FormCadastro";
import { redirect } from 'next/navigation';
import { getPermissoesEfetivas } from '@/actions/PermissoesSetor';
import db from '@/lib/prisma';

const ROLES_GESTAO = ['Admin', 'CEO', 'RECURSOS HUMANOS', 'FINANCEIRO'];

export default async function CadastroPage() {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  const userId = Number(session?.user?.id);

  // Busca role do DB — evita role stale no JWT
  const dbUser = userId > 0
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { role: true } })
    : null;
  const role = dbUser?.role ?? session?.user?.role ?? '';

  if (!ROLES_GESTAO.includes(role)) {
    const permissoes = userId > 0 ? await getPermissoesEfetivas(userId) : [];
    if (!permissoes.includes("cadastro")) {
      redirect("/PainelAlpha");
    }
  }

  return (
    <main className="text-alpha min-h-screen bg-[#020617] flex flex-col">
      <div className="text-alpha flex-1 w-full h-full flex flex-col overflow-hidden">
        <CadastroUsuarios currentUserRole={role} />
      </div>
    </main>
  );
}
