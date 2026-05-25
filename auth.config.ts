import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  pages: {
    signIn: "/",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPrivateRoute = nextUrl.pathname.startsWith("/PainelAlpha");

      if (isPrivateRoute) {
        if (!isLoggedIn) return false;

        const senhaTemporaria = !!(auth?.user as any)?.senhaTemporaria;
        const isMudarSenhaPage = nextUrl.pathname === "/PainelAlpha/mudar-senha";

        if (senhaTemporaria && !isMudarSenhaPage) {
          return Response.redirect(new URL("/PainelAlpha/mudar-senha", nextUrl));
        }

        return true;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;