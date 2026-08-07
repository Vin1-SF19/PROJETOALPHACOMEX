import { z } from "zod";
import { baseComponenteSchema } from "./slide-componentes-base";

/**
 * Categoria "Backgrounds" — fundos animados de tela cheia extraídos dos módulos reais do
 * painel (Cosmos IAlpha, Radar, CS&NPS/CheckList/Agenda Alpha, Blueprint) + o shader de
 * Aurora usado em Extratos/Parceiros. Um único tipo com `estilo` como discriminador interno
 * (mesmo idioma de `container.layout`), em vez de 1 tipo por estilo — evita 7 entradas na
 * união discriminada para uma mesma "família" de componente.
 */
export const fundoAnimadoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("fundoAnimado"),
  estilo: z.enum(["cosmosIAlpha", "radar", "estelar", "blueprintTecnico", "auroraModulos"]),
  /** Só relevante para estilo "estelar" — define os valores iniciais ao arrastar da paleta, livremente editável depois. */
  preset: z.enum(["csNps", "checklist", "agendaAlpha"]).optional(),
  corPrimaria: z.string().default("#4f46e5"),
  corSecundaria: z.string().default("#0ea5e9"),
  /** Multiplicador de velocidade (1 = ritmo original do módulo de origem). */
  velocidade: z.number().min(0.1).max(5).default(1),
  /** Multiplicador de densidade (estrelas/blips/âncoras, conforme o estilo). */
  densidade: z.number().min(0.2).max(3).default(1),
  direcao: z.enum(["horario", "antihorario"]).default("horario"),
  /** Brilho/opacidade geral — usado sobretudo pela Aurora (shader). */
  intensidade: z.number().min(0.1).max(2).default(1),
  mostrarSol: z.boolean().default(true),
  quantidadePlanetas: z.number().int().min(1).max(8).default(8),
  mostrarGrade: z.boolean().default(true),
  mostrarRelogio: z.boolean().default(false),
});

export type FundoAnimadoComponente = z.infer<typeof fundoAnimadoComponenteSchema>;
