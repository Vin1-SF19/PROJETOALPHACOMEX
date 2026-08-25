import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { aggregateClientEvents } from '@/lib/timeline/aggregator';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const clientId = Number(id);

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
  }

  const permissoes: string[] = (session.user as any).permissoes ?? [];
  const role: string | undefined = (session.user as any).role;

  try {
    const result = await aggregateClientEvents(clientId, permissoes, role);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
