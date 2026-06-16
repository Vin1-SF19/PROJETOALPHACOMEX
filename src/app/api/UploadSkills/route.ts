import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: process.env.SKILLS_READ_WRITE_TOKEN, 
      onBeforeGenerateToken: async (_pathname) => {
        return {
          allowedContentTypes: [
            'video/mp4',
            'video/webm',
            'image/jpeg',
            'image/png',
            'image/webp',
          ],
          maximumSizeInBytes: 2.5 * 1024 * 1024 * 1024, // 2.5 GB
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}