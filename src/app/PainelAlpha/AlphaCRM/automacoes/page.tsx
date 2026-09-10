import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AutomacoesBpmPage() {
  redirect("/PainelAlpha/AlphaCRM/admin/automacoes");
}
