import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    

    if (!filename) {
      return NextResponse.json({ error: "Nome do arquivo ausente" }, { status: 400 });
    }

    const blob = await put(filename, request.body!, {
        access: 'public',
        addRandomSuffix: true,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      

    return NextResponse.json(blob);
  } catch (error) {
    console.error("Falha no upload do chat:", error);
    return NextResponse.json({ error: "Falha no upload" }, { status: 500 });
  }
}
