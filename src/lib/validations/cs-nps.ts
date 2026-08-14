import { z } from "zod";

// Fase 3.6 do Cliente Master (2026-08-14) — CS&NPS não cria mais registros soltos:
// `Cliente` (empresa) é resolvido OU CRIADO por CNPJ (mesmo padrão de ContratoComercial:
// o BPM ainda não é a porta de entrada real de Cliente novo), `ClienteServico` é sempre
// criado (é o "serviço contratado" propriamente dito).
export const cadastrarClienteSchema = z.object({
  cnpj: z.string().min(11, "CNPJ inválido").max(20),
  razaoSocial: z.string().trim().min(1, "Informe a razão social").max(200),
  nomeFantasia: z.string().trim().max(200).optional(),
  dataConstituicao: z.string().max(40).optional(),
  uf: z.string().max(8).optional(),
  municipio: z.string().max(120).optional(),
  regimeTributario: z.string().max(120).optional(),
  servico: z.string().trim().min(1, "Selecione o serviço"),
  analistaResponsavel: z.string().max(120).optional(),
  embasamento: z.string().max(120).optional(),
  origemLead: z.string().max(120).optional(),
  dataContratacao: z.string().max(40).optional(),
  formaPagamento: z.string().max(120).optional(),
  valorContrato: z.coerce.number().optional(),
  closerNome: z.string().max(120).optional(),
});
export type CadastrarClienteInput = z.infer<typeof cadastrarClienteSchema>;

// Telefone obrigatório a partir desta fase (decisão do plano Cliente Master, pergunta 8) —
// sócios legados sem telefone ficam retidos como pendência de saneamento, não migram.
export const socioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome"),
  telefone: z.string().trim().min(8, "Telefone é obrigatório"),
  dataNascimento: z.string().max(40).optional(),
  vinculo: z.string().trim().min(1, "Selecione o vínculo"),
  obs: z.string().max(500).optional(),
});
export type SocioInput = z.infer<typeof socioSchema>;

export const logRegistroSchema = z.object({
  sentimento: z.string().min(1, "Selecione o sentimento"),
  observacao: z.string().max(2000).optional().default(""),
  data_registro: z.string().min(1, "Informe a data"),
});
export type LogRegistroInput = z.infer<typeof logRegistroSchema>;

// Campos cadastrais de `Cliente` — editáveis via `salvarAlteracoesCliente`. CNPJ
// deliberadamente de fora: somente-leitura fora do BPM (mesmo princípio já aplicado em
// Extratos/Operacional/ContratoComercial — trocar de CNPJ significa trocar de empresa).
export const alteracoesClienteSchema = z.object({
  razaoSocial: z.string().trim().min(1, "Informe a razão social").max(200),
  nomeFantasia: z.string().trim().max(200).nullable(),
  dataConstituicao: z.string().max(40).nullable(),
  regimeTributario: z.string().max(120).nullable(),
  uf: z.string().max(8).nullable(),
  municipio: z.string().max(120).nullable(),
});
export type AlteracoesClienteInput = z.infer<typeof alteracoesClienteSchema>;

// Campos de negócio de `ClienteServico` — editáveis via `salvarAlteracoesServico`.
export const alteracoesServicoSchema = z.object({
  analistaResponsavel: z.string().max(120).nullable(),
  dataContratacao: z.string().max(40).nullable(),
  status: z.string().min(1).max(40),
  nps: z.coerce.number().int().nullable(),
  feedbackGoogle: z.boolean(),
  nomeGoogle: z.string().max(200).nullable(),
  embasamento: z.string().max(120).nullable(),
  origemLead: z.string().max(120).nullable(),
  dataExito: z.string().max(40).nullable(),
  formaPagamento: z.string().max(120).nullable(),
  valorContrato: z.coerce.number().nullable(),
  closerNome: z.string().max(120).nullable(),
});
export type AlteracoesServicoInput = z.infer<typeof alteracoesServicoSchema>;
