import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../auth';

export const dynamic = 'force-dynamic';

interface FileUpload {
  filename: string;
  type: string;
  size: number;
  url: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticação
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = Number(session.user.id);
    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // 2. Obter tokens de upload (endpoint pré-assinado)
    const body = await request.json() as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      token: process.env.BIBBLE_BLOB_TOKEN, // Token de escrita no Vercel Blob (bibble-files)
      onBeforeGenerateToken: async (path) => {
        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/webm',
            'video/x-matroska',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv',
            'application/json',
            'application/zip',
            'application/x-zip-compressed',
          ],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10MB por arquivo
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('[BIBBLE UPLOAD] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload token' },
      { status: 400 }
    );
  }
}

// Interface para upload após obtain token
export interface FileUploadResponse {
  success: boolean;
  file?: FileUpload;
  error?: string;
}

// Endpoint secundário para upload direto
export async function PUT(request: NextRequest) {
  try {
    // Extrair URL e token da query
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const token = searchParams.get('token');

    if (!filename || !token) {
      return NextResponse.json(
        { error: 'Missing filename or token' },
        { status: 400 }
      );
    }

    const arrayBuffer = await request.arrayBuffer();
    const blob = new Blob([arrayBuffer]);

    const response = await fetch(
      `${process.env.BIBBLE_BLOB_URL}/upload/${encodeURIComponent(filename)}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': token,
          'Content-Type': blob.type || 'application/octet-stream',
        },
        body: blob,
      }
    );

    if (!response.ok) {
      throw new Error(`Blob upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      file: {
        filename,
        url: result.url,
        size: blob.size,
        type: blob.type || 'application/octet-stream',
      },
    });
  } catch (error) {
    console.error('[BIBBLE UPLOAD DIRECT] Error:', error);
    return NextResponse.json(
      { error: 'File upload failed' },
      { status: 500 }
    );
  }
}
