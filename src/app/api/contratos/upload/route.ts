import { auth } from "../../../../../auth";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

// Rate limiting simples em memória (5 uploads/min por usuário)
const uploadTimestamps = new Map<string, number[]>();

function verificarRateLimit(userId: string): boolean {
    const agora = Date.now();
    const janela = 60 * 1000;
    const limite = 5;
    const registros = (uploadTimestamps.get(userId) || []).filter((t) => agora - t < janela);
    if (registros.length >= limite) return false;
    registros.push(agora);
    uploadTimestamps.set(userId, registros);
    return true;
}

export async function POST(request: Request): Promise<NextResponse> {
    const session = await auth();
    const user = session?.user as { id?: string; role?: string } | undefined;

    if (!user?.id) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const role = user.role ?? "";
    const isPermitido = role === "Admin" || role === "CEO" || role === "FINANCEIRO" || role === "Lider Comercial" || role === "COMERCIAL";
    if (!isPermitido) {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    if (!verificarRateLimit(user.id)) {
        return NextResponse.json(
            { error: "Limite de uploads atingido. Tente novamente em alguns minutos." },
            { status: 429 },
        );
    }

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");
    if (!filename) {
        return NextResponse.json({ error: "Nome do arquivo ausente" }, { status: 400 });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "Arquivo excede o limite de 10MB" }, { status: 413 });
    }

    const buffer = await request.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (bytes.length > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "Arquivo excede o limite de 10MB" }, { status: 413 });
    }

    // Valida magic bytes PDF: %PDF = 0x25 0x50 0x44 0x46
    const isPdf =
        bytes.length >= 4 &&
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46;

    if (!isPdf) {
        return NextResponse.json({ error: "Apenas arquivos PDF são aceitos" }, { status: 415 });
    }

    try {
        const blob = await put(`contratos/${user.id}/${Date.now()}_${filename}`, buffer, {
            access: "public",
            addRandomSuffix: true,
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        return NextResponse.json({ url: blob.url });
    } catch (err) {
        console.error("contratos/upload:", err);
        return NextResponse.json({ error: "Erro ao fazer upload" }, { status: 500 });
    }
}
