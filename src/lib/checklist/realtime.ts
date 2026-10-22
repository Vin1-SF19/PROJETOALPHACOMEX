export type TransporteChecklist =
  | { valid: true; transport: "polling" }
  | { valid: false; transport: null };

/** Pure and client-safe: callers pass the literal public environment variable. */
export function resolverTransporteChecklist(
  mode: string | undefined,
): TransporteChecklist {
  if (mode === undefined || mode === "polling") {
    return { valid: true, transport: "polling" };
  }
  return { valid: false, transport: null };
}

/** No CheckList channel is enabled, including legacy or future namespaces. */
export function canalReservadoChecklist(channelName: string): boolean {
  return channelName.startsWith("private-checklist");
}
