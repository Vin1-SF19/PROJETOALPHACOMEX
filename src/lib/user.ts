import { compareSync } from "bcryptjs";
import db from "./prisma";

type User = {
  usuario: string;
  id: string;
  nome: string;
  email: string;
  senha?: string;
  role: string;
  permissoes: string[];
  imagemUrl?: string | null;
  atalhos?: string | null;
  tema_interface?: string | null;
  densidade_painel?: string | null;
  esconderBloqueados?: boolean;
  presetId?: string | null;
  senhaTemporaria?: boolean;
};

export async function findUserByCredentials(
  email: string,
  senha: string,
): Promise<User | null> {
  const user = await db.usuarios.findFirst({
    where: { email },
    include: {
      presets: true,
    }
  });

  if (!user) return null;

  const presetId = (user as any).presets?.[0]?.id || null;
  const passwordMatch = await compareSync(senha, user.senha);

  if (!passwordMatch) return null;


  return {
    id: String(user.id),
    email: user.email,
    usuario: user.usuario,
    nome: user.nome,
    role: user.role,
    presetId: presetId,
    permissoes: user.permissoes?.split(",") ?? [],
    imagemUrl: (user as any).imagemUrl ?? null,
    atalhos: (user as any).atalhos ?? null,
    tema_interface: (user as any).tema_interface ?? "blue",
    densidade_painel: (user as any).densidade_painel ?? "default",
    esconderBloqueados: !!(user as any).esconderBloqueados,
    senhaTemporaria: !!(user as any).senhaTemporaria,
  };
}
