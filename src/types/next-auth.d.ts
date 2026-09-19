import "next-auth";

declare module "next-auth" {
  interface Session {
    acessoBloqueado?: boolean;
    authenticatedAt?: number;
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
      senhaTemporaria?: boolean;
      authSessionVersion?: number;
      presetId?: string | null;
      tema_interface?: string | null;
      densidade_painel?: string | null;
      bibble_ativo?: boolean;
      setor?: string;
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
    senhaTemporaria?: boolean;
    authSessionVersion?: number;
    imagemUrl?: string | null;
    esconderBloqueados?: boolean;
    presetId?: string | null;
    tema_interface?: string | null;
    densidade_painel?: string | null;
    bibble_ativo?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    authenticatedAt?: number;
    id?: string;
    nome?: string;
    usuario?: string;
    email?: string;
    role?: string;
    permissoes?: string[];
    statusUsuario?: string;
    acessoBloqueado?: boolean;
    senhaTemporaria?: boolean;
    authSessionVersion?: number;
    imagemUrl?: string | null;
    atalhos?: string | null;
    esconderBloqueados?: boolean;
    presetId?: string | null;
    tema_interface?: string | null;
    densidade_painel?: string | null;
    bibble_ativo?: boolean;
  }
}
