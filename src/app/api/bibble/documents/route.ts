import { NextResponse } from 'next/server';

// Este endpoint foi substituído por /api/bibble/upload-to-blob
export async function POST() {
  return NextResponse.json(
    { error: 'Use /api/bibble/upload-to-blob para upload de arquivos' },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: 'Use /api/bibble/upload-to-blob para upload de arquivos' },
    { status: 410 }
  );
}
