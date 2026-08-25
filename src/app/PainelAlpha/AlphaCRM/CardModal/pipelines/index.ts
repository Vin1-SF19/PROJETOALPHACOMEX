import type { ReactNode } from "react";
import type { CardAbertoLayoutProps } from "../CardAbertoLayout";
import { CardAbertoLayout } from "../CardAbertoLayout";

type PipelineLayoutComponent = (props: CardAbertoLayoutProps) => ReactNode;

const PIPELINE_LAYOUT_REGISTRY: Record<string, PipelineLayoutComponent> = {
  // Pipelines com layout customizado entram aqui.
  // Exemplo: "financeiro": CardAbertoLayoutFinanceiro,
  // "revisao de radar": CardAbertoLayoutRevisaoRadar,
};

export function resolveCardAbertoLayout(pipelineNome: string): PipelineLayoutComponent {
  const chave = pipelineNome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return PIPELINE_LAYOUT_REGISTRY[chave] ?? CardAbertoLayout;
}
