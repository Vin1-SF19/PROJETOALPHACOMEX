export type RepresentantePersistido = {
  tipo: string;
  documento: string;
  nome: string;
  dataNascimento: string | null;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
};

export type ResponsavelForm = {
  nome: string;
  cpf: string;
  dataNascimento: string;
  cargo: string;
  email: string;
  whatsapp: string;
};

export type ResponsavelPayload = {
  nome: string;
  telefone: string;
  cpf?: string;
  dataNascimento?: string;
  cargo?: string;
  email?: string;
};

export function criarResponsavelVazio(): ResponsavelForm {
  return {
    nome: "",
    cpf: "",
    dataNascimento: "",
    cargo: "",
    email: "",
    whatsapp: "",
  };
}

export function formatarCpf(valor: string): string {
  return valor
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3}\.\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2");
}

export function criarFormularioResponsaveis(
  representantes: RepresentantePersistido[],
): ResponsavelForm[] {
  if (representantes.length === 0) return [criarResponsavelVazio()];

  return representantes.map((representante) => ({
    nome: representante.nome,
    cpf: formatarCpf(representante.documento),
    dataNascimento: representante.dataNascimento ?? "",
    cargo: representante.cargo ?? "",
    email: representante.email ?? "",
    whatsapp: representante.telefone ?? "",
  }));
}

export function montarPayloadResponsaveis(
  responsaveis: ResponsavelForm[],
): ResponsavelPayload[] {
  return responsaveis
    // WhatsApp obrigatório desde a Fase 3.1b (Cliente Master) — todo representante
    // vira Pessoa, que exige celular como chave única.
    .filter((responsavel) => responsavel.nome.trim().length >= 2 && responsavel.whatsapp.trim().length >= 8)
    .map((responsavel) => ({
      nome: responsavel.nome.trim(),
      telefone: responsavel.whatsapp.trim(),
      cpf: responsavel.cpf.replace(/\D/g, "") || undefined,
      dataNascimento: responsavel.dataNascimento || undefined,
      cargo: responsavel.cargo.trim() || undefined,
      email: responsavel.email.trim() || undefined,
    }));
}
