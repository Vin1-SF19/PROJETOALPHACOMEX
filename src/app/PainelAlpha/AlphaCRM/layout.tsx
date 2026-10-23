import { cookies } from "next/headers";
import { CardSaveProvider } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import CRMLayout from "./CRMLayoutClient";
import { CRM_TEMA_COOKIE, normalizarCrmTema } from "./crm-tema";

export default async function AlphaCRMLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/");
  const temaInicial = normalizarCrmTema((await cookies()).get(CRM_TEMA_COOKIE)?.value);
  return <CRMLayout session={session} temaInicial={temaInicial}><CardSaveProvider>{children}</CardSaveProvider></CRMLayout>;
}
