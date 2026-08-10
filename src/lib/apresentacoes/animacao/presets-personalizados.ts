import { z } from "zod";
import { elementAnimationSchema } from "@/lib/validations/slide-animacao-config";
import { PRESETS_ANIMACAO_COMPLETOS, type AnimacaoPreset } from "./presets-completos";

export const animacaoPresetPersonalizadaSchema = elementAnimationSchema.omit({ id: true, elementId: true });

export const presetAnimacaoPersonalizadoSchema = z.object({
  id: z.string().trim().min(1).max(120),
  nome: z.string().trim().min(1, "Informe o nome do preset.").max(80),
  descricao: z.string().trim().max(280).default(""),
  animacoes: z.array(animacaoPresetPersonalizadaSchema).min(1, "Adicione pelo menos uma animação.").max(16),
  atualizadoEm: z.string().datetime(),
});

export const presetsAnimacaoPersonalizadosSchema = z.array(presetAnimacaoPersonalizadoSchema).max(50);

export type PresetAnimacaoPersonalizado = z.infer<typeof presetAnimacaoPersonalizadoSchema>;

export interface PresetAnimacaoDisponivel {
  id: string;
  nome: string;
  descricao: string;
  origem: "nativo" | "personalizado";
  animacoes: AnimacaoPreset[];
}

export function normalizarPresetsAnimacaoPersonalizados(valor: unknown): PresetAnimacaoPersonalizado[] {
  const resultado = presetsAnimacaoPersonalizadosSchema.safeParse(valor);
  return resultado.success ? resultado.data : [];
}

export function listarPresetsAnimacaoDisponiveis(
  personalizados: PresetAnimacaoPersonalizado[],
): PresetAnimacaoDisponivel[] {
  const nativos = Object.entries(PRESETS_ANIMACAO_COMPLETOS).map(([id, preset]) => ({
    id,
    nome: preset.nome,
    descricao: preset.descricao,
    origem: "nativo" as const,
    animacoes: preset.criar(),
  }));
  const customizados = personalizados.map((preset) => ({
    id: preset.id,
    nome: preset.nome,
    descricao: preset.descricao,
    origem: "personalizado" as const,
    animacoes: preset.animacoes.map((animacao) => ({ ...animacao })),
  }));
  return [...nativos, ...customizados];
}

export function removerPresetsDoPacoteDoSlide<T extends { presetsAnimacao?: PresetAnimacaoPersonalizado[] }>(
  dados: T,
): Omit<T, "presetsAnimacao"> {
  const restante: Partial<T> = { ...dados };
  delete restante.presetsAnimacao;
  return restante as Omit<T, "presetsAnimacao">;
}
