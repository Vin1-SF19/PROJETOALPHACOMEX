import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByCredentials } from "@/lib/user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        senha: { type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.senha) return null;

        const user = await findUserByCredentials(
          String(credentials.email),
          String(credentials.senha)
        );

        if (!user) return null;


        return {
          id: String(user.id),
          email: user.email,
          nome: user.nome,
          usuario: user.usuario,
          role: user.role,
          presetId: user.presetId,
          permissoes: (user as any).permissoes,
          imagemUrl: (user as any).imagemUrl,
          atalhos: (user as any).atalhos,
          tema_interface: (user as any).tema_interface,
          densidade_painel: (user as any).densidade_painel,
          esconderBloqueados: (user as any).esconderBloqueados,
          bibble_ativo: (user as any).bibble_ativo ?? true,
          senhaTemporaria: !!(user as any).senhaTemporaria,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24,
  },

  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.nome = (user as any).nome;
        token.usuario = (user as any).usuario;
        token.role = (user as any).role;
        token.permissoes = (user as any).permissoes;
        token.imagemUrl = (user as any).imagemUrl;
        token.atalhos = (user as any).atalhos;
        token.esconderBloqueados = (user as any).esconderBloqueados;
        token.tema_interface = (user as any).tema_interface;
        token.densidade_painel = (user as any).densidade_painel;
        token.presetId = (user as any).presetId;
        token.usuario = (user as any).usuario;
        token.bibble_ativo = (user as any).bibble_ativo ?? true;
        token.senhaTemporaria = !!(user as any).senhaTemporaria;

      }

      if (trigger === "update" && session?.user) {
        if (session.user.imagemUrl !== undefined) token.imagemUrl = session.user.imagemUrl;
        if (session.user.atalhos !== undefined) token.atalhos = session.user.atalhos;
        if (session.user.esconderBloqueados !== undefined) token.esconderBloqueados = session.user.esconderBloqueados;
        if (session.user.tema_interface) token.tema_interface = session.user.tema_interface;
        if (session.user.densidade_painel) token.densidade_painel = session.user.densidade_painel;
        if ((session.user as any).bibble_ativo !== undefined) token.bibble_ativo = (session.user as any).bibble_ativo;
        if ((session.user as any).senhaTemporaria === false) token.senhaTemporaria = false;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.nome = token.nome as string;
        session.user.usuario = token.usuario as string;
        session.user.email = token.email as string;
        session.user.role = token.role as string;
        (session.user as any).setor = token.role as string;
        session.user.imagemUrl = token.imagemUrl as string;
        session.user.permissoes = token.permissoes as string[];
        session.user.atalhos = token.atalhos as string;
        session.user.esconderBloqueados = !!token.esconderBloqueados;
        (session.user as any).tema_interface = token.tema_interface;
        (session.user as any).densidade_painel = token.densidade_painel;
        (session.user as any).presetId = token.presetId;
        (session.user as any).usuario = token.usuario;
        (session.user as any).bibble_ativo = token.bibble_ativo ?? true;
        (session.user as any).senhaTemporaria = !!token.senhaTemporaria;

      }

      return session;
    },
  },
});
