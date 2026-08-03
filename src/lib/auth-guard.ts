import { auth } from "../../auth";
import { isAdminRole } from "@/lib/roles";

export async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    throw new Error("NOT_AUTHENTICATED");
  }

  if (!isAdminRole(session.user.role)) {
    throw new Error("Voce nao tem permissao");
  }

  return session;
}
