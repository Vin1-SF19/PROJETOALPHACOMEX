import { route, methodNotAllowed } from '@/lib/portal-api/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const GET = async (request: Request, context: {
    params: Promise<{
        id: string;
    }>;
}) => { const { id } = await context.params; return route('downloadDocument', 'P', async (...args) => (await import('@/lib/portal-api/file-handlers')).downloadDocument(id)(...args))(request); };
const disallowed = methodNotAllowed('GET');
export const POST = disallowed;
export const PUT = disallowed;
export const PATCH = disallowed;
export const DELETE = disallowed;
export const HEAD = disallowed;
export const OPTIONS = disallowed;
