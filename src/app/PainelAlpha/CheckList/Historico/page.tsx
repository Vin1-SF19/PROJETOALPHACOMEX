import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import { getHistoricoDocumentosExcluidos } from "@/actions/checklist";
import HistoricoClient from "./HistoricoClient";

export default async function HistoricoPage() {
  const session = await auth();
  if (!session) redirect("/");

  const result = await getHistoricoDocumentosExcluidos();
  const docs = result.data ?? [];

  return <HistoricoClient docs={docs} />;
}
