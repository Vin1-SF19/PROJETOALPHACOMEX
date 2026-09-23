import type { colaboradores_core, sistemas_core, vault_recursos } from "@prisma/client";

export type ColaboradorVault = {
  id: number | string;
  nome: string;
  role: string;
  cargo: string | null;
  data_contratacao: string | null;
  status: string | null;
  tema_interface: string | null;
  tipo: "Usuario" | "Agente";
  email: string | null;
};

export type SistemaVault = sistemas_core;
export type RecursoVault = vault_recursos & Pick<sistemas_core, "icone" | "link"> & {
  sistema_nome: string;
};

export type ColaboradorExterno = colaboradores_core;
