import { validarConvitePublico } from "@/actions/convites-parceiro";
import ConviteWizard from "@/components/Parceiros/Convite/ConviteWizard";
import ConviteInvalido from "@/components/Parceiros/ConviteInvalido";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Convite de Parceria — Alpha Comex & Compliance",
  description: "Formulário de cadastro de parceiro.",
};

export default async function ConviteParceiroPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resultado = await validarConvitePublico(token);

  if (!resultado.valido) {
    return <ConviteInvalido motivo={resultado.motivo} />;
  }

  return <ConviteWizard token={token} termo={resultado.termo} />;
}
