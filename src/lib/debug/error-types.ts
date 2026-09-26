export type DebugLevel = "error" | "warn" | "info";

export type DebugSource =
  | "console"
  | "unhandledrejection"
  | "unhandlederror"
  | "server-action"
  | "api"
  | "custom";

export interface DebugEvent {
  id: string;
  ts: string;
  level: DebugLevel;
  source: DebugSource;
  message: string;
  stack?: string;
  meta?: Record<string, unknown>;
}

export const DEBUG_MAX_EVENTS = 200;
export const DEBUG_MAX_MESSAGE_LENGTH = 1000;
export const DEBUG_MAX_STACK_LENGTH = 8000;
export const DEBUG_EVENT_NAME = "alpha-debug:event";
