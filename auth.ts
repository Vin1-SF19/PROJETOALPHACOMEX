import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByCredentials } from "@/lib/user";
import {
  bloquearTokenAcesso,
  revalidarTokenAcesso,
  STATUS_USUARIO_ATIVO,
} from "@/lib/auth/acesso-painel";
import {
  clearAuthRateLimit,
  consumeAuthRateLimit,
  getAuthRequestAddress,
  normalizeAuthIdentifier,
} from "@/lib/auth/rate-limit";

const nextAuth = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        senha: { type: "password" },
      },

      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.senha) return null;

        const email = normalizeAuthIdentifier(String(credentials.email));
        const requestAddress = getAuthRequestAddress(request.headers);
        const [ipLimit, identifierLimit] = await Promise.all([
          consumeAuthRateLimit("login_ip", requestAddress),
          consumeAuthRateLimit("login_identifier", email),
        ]);
        if (!ipLimit.allowed || !identifierLimit.allowed) return null;

        const user = await findUserByCredentials(
          email,
          String(credentials.senha)
        );

        if (!user) return null;

        try {
          await clearAuthRateLimit("login_identifier", email);
        } catch (error) {
          console.error("Falha ao limpar limite de login após autenticação válida:", error);
        }


        return {
          id: String(user.id),
          email: user.email,
          nome: user.nome,
          usuario: user.usuario,
          role: user.role,
          presetId: user.presetId,
          permissoes: user.permissoes,
          imagemUrl: user.imagemUrl,
          atalhos: user.atalhos,
          tema_interface: user.tema_interface,
          densidade_painel: user.densidade_painel,
          esconderBloqueados: user.esconderBloqueados,
          bibble_ativo: user.bibble_ativo ?? true,
          senhaTemporaria: !!user.senhaTemporaria,
          authSessionVersion: user.authSessionVersion,
          statusUsuario: STATUS_USUARIO_ATIVO,
          acessoBloqueado: false,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24,
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.authenticatedAt = Math.floor(Date.now() / 1000);
        token.id = user.id;
        token.email = user.email;
        token.nome = user.nome;
        token.usuario = user.usuario;
        token.role = user.role;
        token.permissoes = Array.isArray(user.permissoes)
          ? user.permissoes
          : user.permissoes?.split(",");
        token.imagemUrl = user.imagemUrl;
        token.atalhos = user.atalhos;
        token.esconderBloqueados = user.esconderBloqueados;
        token.tema_interface = user.tema_interface;
        token.densidade_painel = user.densidade_painel;
        token.presetId = user.presetId;
        token.bibble_ativo = user.bibble_ativo ?? true;
        token.senhaTemporaria = !!user.senhaTemporaria;
        token.authSessionVersion = Number(user.authSessionVersion ?? 0);
        token.statusUsuario = STATUS_USUARIO_ATIVO;
        token.acessoBloqueado = false;
      } else {
        token = await revalidarTokenAcesso(token);
      }

      if (token.acessoBloqueado) {
        return bloquearTokenAcesso(token);
      }

      if (trigger === "update" && session?.user) {
        if (session.user.imagemUrl !== undefined) token.imagemUrl = session.user.imagemUrl;
        if (session.user.atalhos !== undefined) token.atalhos = session.user.atalhos;
        if (session.user.esconderBloqueados !== undefined) token.esconderBloqueados = session.user.esconderBloqueados;
        if (session.user.tema_interface) token.tema_interface = session.user.tema_interface;
        if (session.user.densidade_painel) token.densidade_painel = session.user.densidade_painel;
        if (session.user.bibble_ativo !== undefined) token.bibble_ativo = session.user.bibble_ativo;
      }

      return token;
    },

    async session({ session, token }) {
      if (token.acessoBloqueado || !token.id) {
        session.user = undefined as never;
        session.acessoBloqueado = true;
        return session;
      }

      if (session.user) {
        session.authenticatedAt = token.authenticatedAt;
        session.user.id = token.id as string;
        session.user.nome = token.nome as string;
        session.user.usuario = token.usuario as string;
        session.user.email = token.email as string;
        session.user.role = token.role as string;
        session.user.setor = token.role as string;
        session.user.imagemUrl = token.imagemUrl as string;
        session.user.permissoes = token.permissoes as string[];
        session.user.atalhos = token.atalhos as string;
        session.user.esconderBloqueados = !!token.esconderBloqueados;
        session.user.tema_interface = token.tema_interface;
        session.user.densidade_painel = token.densidade_painel;
        session.user.presetId = token.presetId;
        session.user.usuario = token.usuario as string;
        session.user.bibble_ativo = token.bibble_ativo ?? true;
        session.user.senhaTemporaria = !!token.senhaTemporaria;
        session.user.authSessionVersion = Number(token.authSessionVersion ?? 0);
        session.acessoBloqueado = false;
      }

      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

export async function authComEstadoAcesso() {
  return nextAuth.auth();
}

export async function auth() {
  const session = await authComEstadoAcesso();

  if (session?.acessoBloqueado) {
    return null;
  }

  return session;
}
