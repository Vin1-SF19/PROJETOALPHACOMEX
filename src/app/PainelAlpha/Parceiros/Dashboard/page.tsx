import { redirect } from "next/navigation";

// O Dashboard foi unificado com a página inicial do módulo (aba "Visão Geral" de
// /PainelAlpha/Parceiros) — esta rota existe só para não quebrar links/atalhos antigos.
export default function DashboardParceirosPageRedirect() {
  redirect("/PainelAlpha/Parceiros");
}
