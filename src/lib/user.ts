import { compare } from "bcryptjs";
import db from "./prisma";
import {
  statusPermiteAcessoPainel,
  STATUS_USUARIO_ATIVO,
} from "./auth/acesso-painel";

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
  authSessionVersion: number;
  bibble_ativo?: boolean;
};

// Mantém o mesmo custo de bcrypt quando o identificador não existe ou está
// inativo, reduzindo o sinal temporal usado para enumerar contas.
const INVALID_CREDENTIAL_HASH =
  "$2b$12$mAspyBYrDkFMzkve9CA3TeB12YezNr12QeEaxeTCDFZSdIJ3O4yPi";

export async function findUserByCredentials(
  email: string,
  senha: string,
): Promise<User | null> {
  const user = await db.usuarios.findFirst({
    where: {
      email,
      status: STATUS_USUARIO_ATIVO,
    },
    include: {
      presets: true,
    }
  });

  const passwordMatch = await compare(senha, user?.senha ?? INVALID_CREDENTIAL_HASH);

  if (!user || !statusPermiteAcessoPainel(user.status) || !passwordMatch) return null;

  const presetId = user.presets[0]?.id ?? null;

  return {
    id: String(user.id),
    email: user.email,
    usuario: user.usuario,
    nome: user.nome,
    role: user.role,
    presetId: presetId,
    permissoes: user.permissoes?.split(",") ?? [],
    imagemUrl: user.imagemUrl,
    atalhos: user.atalhos,
    tema_interface: user.tema_interface ?? "blue",
    densidade_painel: user.densidade_painel ?? "default",
    esconderBloqueados: user.esconderBloqueados,
    senhaTemporaria: user.senhaTemporaria,
    authSessionVersion: user.authSessionVersion,
    bibble_ativo: user.bibble_ativo,
  };
}
