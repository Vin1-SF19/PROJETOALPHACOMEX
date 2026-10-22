export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "MODEL_EMPTY"
  | "MODEL_CODE_CONFLICT"
  | "UPLOAD_INVALID"
  | "LIMIT_EXCEEDED"
  | "RETRYABLE"
  | "INTERNAL";
export type Result<T> =
  | { ok: true; data: T; requestId: string }
  | {
      ok: false;
      error: {
        code: ErrorCode;
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
      requestId: string;
    };
export type Page<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
};
export type AtorChecklist =
  | { kind: "INTERNO"; id: number; sessionVersion: number }
  | { kind: "PORTAL"; id: string; sessionVersion: number };
export type CapacidadesChecklist = {
  canRead: boolean;
  canEdit: boolean;
  canCreateOwn: boolean;
  canAssignOwner: boolean;
  canManageModels: boolean;
  canManagePortalAccess: boolean;
  canLinkCrm: boolean;
};
export type ResumoChecklist = {
  estado: "SEM_CHECKLIST" | "SEM_ITENS" | "EM_ANDAMENTO" | "COMPLETO";
  total: number;
  concluidos: number;
  pendentes: number;
  percentual: number;
  semObrigatorios: boolean;
};
