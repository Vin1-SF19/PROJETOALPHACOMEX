import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    acessoBloqueado?: boolean;
    user: {
      id: string;
      nome: string;
      usuario: string;
      email: string;
      role: string;
      permissoes?: string[];
      imagemUrl?: string | null;
      atalhos?: string | null;
      esconderBloqueados: boolean;
      statusUsuario?: string;
    };
  }

  interface User {
    id: string;
    nome: string;
    usuario: string;
    email: string;
    role: string;
    permissoes?: string | string[];
    atalhos?: string | null;
    statusUsuario?: string;
    acessoBloqueado?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    nome?: string;
    usuario?: string;
    email?: string;
    role?: string;
    permissoes?: string[];
    statusUsuario?: string;
    acessoBloqueado?: boolean;
  }
}
