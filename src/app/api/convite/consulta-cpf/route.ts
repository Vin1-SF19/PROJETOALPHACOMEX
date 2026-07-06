import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";

// A InfoSimples (campo `birthdate`) exige o formato ISO AAAA-MM-DD.
function paraFormatoInfoSimples(data: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    const [d, m, y] = data.split("/");
    return `${y}-${m}-${d}`;
  }
  return null;
}

const BodySchema = z.object({
  token: z.string().min(10),
  pin: z.string().length(4),
  cpf: z.string().min(11),
  dataNascimento: z.string().min(1),
});

/**
 * Consulta pública de CPF+data de nascimento (InfoSimples) — usada no wizard de
 * convite de parceiro. SEM auth() (rota pública), protegida pelo PIN de 4 dígitos
 * gerado junto com o convite. Convites sem PIN (gerados antes desta feature) NÃO
 * liberam esta busca — evita gastar chamada paga sem essa camada de proteção.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
    }
    const { token, pin, cpf, dataNascimento } = parsed.data;

    const convite = await db.conviteParceiro.findUnique({
      where: { token },
      select: { status: true, expiraEm: true, pin: true },
    });

    if (!convite) return NextResponse.json({ error: "Convite inválido" }, { status: 404 });
    if (convite.status !== "PENDENTE") {
      return NextResponse.json({ error: "Este convite não está mais disponível" }, { status: 403 });
    }
    if (convite.expiraEm.getTime() < Date.now()) {
      return NextResponse.json({ error: "Este convite expirou" }, { status: 403 });
    }
    if (!convite.pin) {
      return NextResponse.json(
        { error: "Este link de convite não suporta busca automática — preencha manualmente" },
        { status: 403 }
      );
    }
    if (convite.pin !== pin) {
      return NextResponse.json({ error: "PIN incorreto" }, { status: 401 });
    }

    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      return NextResponse.json({ error: "CPF inválido — deve ter 11 dígitos" }, { status: 400 });
    }

    const dataFormatada = paraFormatoInfoSimples(dataNascimento);
    if (!dataFormatada) {
      return NextResponse.json(
        { error: "Data de nascimento inválida (esperado DD/MM/AAAA ou AAAA-MM-DD)" },
        { status: 400 }
      );
    }

    const infoToken = process.env.INFOSIMPLES_TOKEN;
    if (!infoToken) {
      return NextResponse.json({ error: "INFOSIMPLES_TOKEN não configurado no servidor" }, { status: 500 });
    }

    const params = new URLSearchParams({
      token: infoToken,
      cpf: cpfLimpo,
      birthdate: dataFormatada,
      timeout: "30",
    });

    const resp = await fetch("https://api.infosimples.com/api/v2/consultas/receita-federal/cpf", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(35000),
    });

    const data = await resp.json();

    if (data.code !== 200 || !data.data?.[0]) {
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

      return NextResponse.json({ error: msgFinal }, { status: 422 });
    }

    const d = data.data[0];

    return NextResponse.json({
      nome: (d.nome || "").toUpperCase(),
      situacao: d.situacao_cadastral || d.situacao || "",
      dataNascimento: d.data_nascimento || dataFormatada,
      dadosBrutos: data,
    });
  } catch (err: unknown) {
    console.error("[convite/consulta-cpf] erro inesperado →", err);
    const message = err instanceof Error ? err.message : "Erro ao consultar CPF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
