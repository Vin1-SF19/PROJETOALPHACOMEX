import { z } from "zod";
export const checklistEventoSchema = z.object({
  eventId: z.string(),
  revision: z.number(),
  tipo: z.string(),
  empresaId: z.string().nullable(),
  createdAt: z.string(),
  lidoEm: z.string().nullable(),
  // Opaque JSON from the HTTP wire; consumers must not parse it as a serialized string.
  dados: z.json(),
});
export const checklistPaginaEventosSchema = z.object({
  items: z.array(checklistEventoSchema),
  nextCursor: z.object({ createdAt: z.string(), id: z.string() }).nullable(),
});
export type ChecklistEvento = z.infer<typeof checklistEventoSchema>;
export function checklistUrl(empresaId: string) {
  return `/PainelAlpha/CheckList/${encodeURIComponent(empresaId)}`;
}
export function abrirChecklistNoPainel(empresaId: string) {
  const url = checklistUrl(empresaId);
  if (window.parent !== window) window.parent.postMessage({ type: "ALPHA_OPEN_TAB", url, label: "Checklist" }, window.location.origin);
  else window.location.assign(url);
}
