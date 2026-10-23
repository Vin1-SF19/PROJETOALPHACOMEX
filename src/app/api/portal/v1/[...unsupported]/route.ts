import { randomUUID } from 'node:crypto';
import { failure } from '@/lib/portal-api/http';
import { PortalError } from '@/lib/portal-api/errors';
export const dynamic = 'force-dynamic';
const missing = () => failure(new PortalError('NOT_FOUND', 404, 'Recurso não encontrado.'), randomUUID());
export const GET = missing, POST = missing, PUT = missing, PATCH = missing, DELETE = missing, HEAD = missing, OPTIONS = missing;
