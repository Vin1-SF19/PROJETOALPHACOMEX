// Espelha, campo a campo, as condições reais de aprovarPreCadastro() em
// src/actions/convites-parceiro.ts. Se aquela função mudar uma regra de
// obrigatoriedade, esta lista precisa mudar junto — é o que garante que o
// checklist visual nunca minta sobre o que falta para aprovar.

export type RepresentanteExtra = {
  nome: string;
  cpf: string;
  dataNascimento: string;
  cargo?: string;
  telefone?: string;
};

export type PendenciaPreCadastro = {
  chave: string;
  label: string;
  ok: boolean;
  bloqueiaAprovacao: boolean;
};

export type PreCadastroParaChecklist = {
  cpf: string | null;
  dataNascimento: string | null;
  cnpj: string | null;
  tipoRecebimento: string | null;
  souRepresentante: boolean;
  representantesExtra: string | null;
  cep: string | null;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

function tipoEfetivo(pc: PreCadastroParaChecklist): "PF" | "PJ" {
  if (pc.tipoRecebimento === "PF" || pc.tipoRecebimento === "PJ") return pc.tipoRecebimento;
  const cnpjLimpo = pc.cnpj?.replace(/\D/g, "") ?? "";
  return cnpjLimpo.length === 14 ? "PJ" : "PF";
}

function representantesExtraValidos(json: string | null): RepresentanteExtra[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as RepresentanteExtra[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) => r.nome?.trim().length >= 2 && (r.cpf ?? "").replace(/\D/g, "").length === 11 && !!r.dataNascimento,
    );
  } catch {
    return [];
  }
}

export function avaliarPendencias(pc: PreCadastroParaChecklist): PendenciaPreCadastro[] {
  const tipo = tipoEfetivo(pc);
  const documento = tipo === "PJ" ? (pc.cnpj?.replace(/\D/g, "") ?? "") : (pc.cpf?.replace(/\D/g, "") ?? "");

  const pendencias: PendenciaPreCadastro[] = [
    {
      chave: "documento",
      label: tipo === "PJ" ? "CNPJ válido (14 dígitos)" : "CPF válido (11 dígitos)",
      ok: documento.length >= 11,
      bloqueiaAprovacao: true,
    },
  ];

  if (tipo === "PJ") {
    const proprioOk = pc.souRepresentante && !!pc.cpf && pc.cpf.replace(/\D/g, "").length === 11 && !!pc.dataNascimento;
    const extrasOk = !pc.souRepresentante && representantesExtraValidos(pc.representantesExtra).length > 0;
    pendencias.push({
      chave: "representante",
      label: pc.souRepresentante
        ? "CPF e data de nascimento (Parceiro é o representante)"
        : "Ao menos um representante com nome, CPF e data de nascimento",
      ok: proprioOk || extrasOk,
      bloqueiaAprovacao: true,
    });
  }

  const enderecoOk = !!(pc.cep && pc.logradouro && pc.bairro && pc.cidade && pc.uf);
  const enderecoParcial = !!(pc.cep || pc.logradouro || pc.bairro || pc.cidade);
  pendencias.push({
    chave: "endereco",
    label: "Endereço completo (CEP, logradouro, bairro, cidade)",
    ok: enderecoOk || !enderecoParcial,
    bloqueiaAprovacao: false,
  });

  return pendencias;
}

export function podeAprovar(pc: PreCadastroParaChecklist): boolean {
  return avaliarPendencias(pc).every((p) => p.ok || !p.bloqueiaAprovacao);
}
