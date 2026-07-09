"use client";

import { LayoutGroup } from "framer-motion";

/**
 * LayoutGroup compartilhado entre a listagem e o detalhe — permite que o
 * layoutId `empresa-card-${id}` seja reconhecido pelo Framer Motion nas duas
 * rotas (páginas distintas do App Router), fazendo o card da linha clicada
 * "morphar" visualmente até virar o header da página de detalhe.
 */
export default function ExtratosBancariosLayout({ children }: { children: React.ReactNode }) {
  return <LayoutGroup id="extratos-bancarios">{children}</LayoutGroup>;
}
