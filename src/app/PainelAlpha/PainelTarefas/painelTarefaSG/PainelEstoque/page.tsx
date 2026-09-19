import { redirect } from "next/navigation";

/** Mantém favoritos e integrações históricas apontando para a única raiz do estoque. */
export default function LegacyInventoryRedirect() {
  redirect("/PainelAlpha/Estoque");
}
