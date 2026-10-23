import { route, methodNotAllowed } from '@/lib/portal-api/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const POST = async (request: Request, context: {
    params: Promise<{
        id: string;
    }>;
}) => { const { id } = await context.params; return route('readNotification', 'P', async (...args) => (await import('@/lib/portal-api/notification-handlers')).readNotification(id)(...args))(request); };
const disallowed = methodNotAllowed('POST');
export const GET = disallowed;
export const PUT = disallowed;
export const PATCH = disallowed;
export const DELETE = disallowed;
export const HEAD = disallowed;
export const OPTIONS = disallowed;
