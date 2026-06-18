import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";

export const dynamic = "force-dynamic";

// Input type="date" envia YYYY-MM-DD; InfoSimples exige DD/MM/YYYY
function paraFormatoInfoSimples(data: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const [y, m, d] = data.split("-");
    return `${d}/${m}/${y}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return data;
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { cpf, dataNascimento } = await req.json();

    const cpfLimpo = (cpf ?? "").replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      return NextResponse.json({ error: "CPF inválido — deve ter 11 dígitos" }, { status: 400 });
    }

    const dataFormatada = paraFormatoInfoSimples(dataNascimento ?? "");
    if (!dataFormatada) {
      return NextResponse.json(
        { error: "Data de nascimento inválida (esperado DD/MM/AAAA ou AAAA-MM-DD)" },
        { status: 400 }
      );
    }

    const token = process.env.INFOSIMPLES_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "INFOSIMPLES_TOKEN não configurado no servidor" }, { status: 500 });
    }

    const body = new URLSearchParams({
      token,
      cpf: cpfLimpo,
      data_nascimento: dataFormatada,
      timeout: "30",
    });

    console.log("[ConsultaCpf] enviando →", { cpf: cpfLimpo, data_nascimento: dataFormatada });

    const resp = await fetch(
      "https://api.infosimples.com/api/v2/consultas/receita-federal/cpf",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: AbortSignal.timeout(35000),
      }
    );

    const data = await resp.json();

    console.log("[ConsultaCpf] resposta →", {
      code: data.code,
      msg: data.msg,
      errors: data.errors,
      data0: data.data?.[0] ? Object.keys(data.data[0]) : "vazio",
    });

    if (data.code !== 200 || !data.data?.[0]) {
      // Mapeia códigos de erro InfoSimples para mensagens amigáveis
      const codigoErro = data.code;
      const msgBruta = data.errors?.[0] || data.msg || "";
      let msgFinal = "CPF não encontrado ou data de nascimento incorreta";

      if (codigoErro === 402 || msgBruta.toLowerCase().includes("saldo")) {
        msgFinal = "Saldo insuficiente na conta InfoSimples";
      } else if (codigoErro === 401 || msgBruta.toLowerCase().includes("token")) {
        msgFinal = "Token InfoSimples inválido ou sem permissão para este endpoint";
      } else if (codigoErro === 404 || msgBruta.toLowerCase().includes("não encontrado")) {
        msgFinal = "CPF não encontrado na base da Receita Federal";
      } else if (codigoErro === 429) {
        msgFinal = "Limite de requisições atingido — tente novamente em instantes";
      } else if (msgBruta) {
        msgFinal = msgBruta;
      }

      return NextResponse.json({ error: msgFinal }, { status: 404 });
    }

    const d = data.data[0];

    return NextResponse.json({
      nome: (d.nome || "").toUpperCase(),
      situacao: d.situacao_cadastral || d.situacao || "",
      dataNascimento: d.data_nascimento || dataFormatada,
      dadosBrutos: data,
    });
  } catch (err: unknown) {
    console.error("[ConsultaCpf] erro inesperado →", err);
    const message = err instanceof Error ? err.message : "Erro ao consultar CPF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
