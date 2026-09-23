import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['video/mp4', 'application/pdf', 'image/jpeg', 'image/png'],
        tokenPayload: JSON.stringify({}),
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Falha no upload:", error);
    return NextResponse.json({ error: "Falha no upload" }, { status: 400 });
  }
}
