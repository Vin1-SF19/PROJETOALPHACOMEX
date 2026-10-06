import 'server-only';
import { auth } from '../../../auth';
import { getPermissoesEfetivas } from '@/actions/PermissoesSetor';
import { isAdminRole } from '@/lib/roles';

export async function acessoCatcher() {
  const session = await auth();
  if (!session?.user) return { status: 401 as const };
  const userId = Number(session.user.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) return { status: 403 as const };
  if (!isAdminRole(session.user.role) && !(await getPermissoesEfetivas(userId)).includes('alphaCatcher')) {
    return { status: 403 as const };
  }
  return { status: 200 as const, tema: session.user.tema_interface || 'blue', userId };
}
