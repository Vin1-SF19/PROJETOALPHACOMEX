import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../../../auth';
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

  const user = session.user as typeof session.user & { permissoes?: string[]; role?: string };
  const permissoes: string[] = user.permissoes ?? [];
  const role: string | undefined = user.role;
  const userId = Number(session.user.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid session user' }, { status: 401 });
  }

  try {
    const result = await aggregateClientEvents(clientId, permissoes, role, userId);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
