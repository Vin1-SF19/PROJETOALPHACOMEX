import { createRequire } from "node:module";

// Node24 supplies this runtime module. Keep its test-only contract local so
// @types/node20 consumers elsewhere retain their existing module contracts.
type SqlValue = string | number | bigint | null | Uint8Array;
interface StatementSync {
  get(...values: SqlValue[]): Record<string, SqlValue> | undefined;
  all(...values: SqlValue[]): Record<string, SqlValue>[];
  run(...values: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}
export interface DatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
  close(): void;
}
export const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => DatabaseSync;
};
