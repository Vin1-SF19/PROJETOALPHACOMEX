import { route, methodNotAllowed } from '@/lib/portal-api/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const PATCH = async (request: Request, context: {
    params: Promise<{
        id: string;
    }>;
}) => { const { id } = await context.params; return route('observeDocument', 'P', async (...args) => (await import('@/lib/portal-api/checklist-handlers')).observeDocument(id)(...args))(request); };
const disallowed = methodNotAllowed('PATCH');
export const GET = disallowed;
export const POST = disallowed;
export const PUT = disallowed;
export const DELETE = disallowed;
export const HEAD = disallowed;
export const OPTIONS = disallowed;
