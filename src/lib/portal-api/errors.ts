import type { ErrorCode } from '../../../contracts/portal-api/v1';
export class PortalError extends Error {
    constructor(public code: ErrorCode, public status: number, message: string, public retryAfter?: number) { super(message); }
}
export function unauthenticated(): never { throw new PortalError('UNAUTHENTICATED', 401, 'Entre novamente.'); }
;
export function notFound(): never { throw new PortalError('NOT_FOUND', 404, 'Recurso não encontrado.'); }
;
