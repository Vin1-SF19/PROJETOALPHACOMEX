export type LoginTransitionPhase =
  | "idle"
  | "validating"
  | "auth_error"
  | "authorized"
  | "covering"
  | "navigation"
  | "traversing"
  | "revealed";

export type LoginTransitionEvent =
  | { type: "SUBMIT" }
  | { type: "AUTH_FAILURE" }
  | { type: "AUTH_SUCCESS" }
  | { type: "COVERING" }
  | { type: "COVERED" }
  | { type: "ROUTE_READY" }
  | { type: "TRAVERSAL_COMPLETE" }
  | { type: "RESET" };

export function reduceLoginTransition(
  phase: LoginTransitionPhase,
  event: LoginTransitionEvent,
): LoginTransitionPhase {
  if (event.type === "SUBMIT" && (phase === "idle" || phase === "auth_error")) {
    return "validating";
  }
  if (event.type === "AUTH_FAILURE" && phase === "validating") return "auth_error";
  if (event.type === "AUTH_SUCCESS" && phase === "validating") return "authorized";
  if (event.type === "COVERING" && phase === "authorized") return "covering";
  if (event.type === "COVERED" && phase === "covering") return "navigation";
  if (event.type === "ROUTE_READY" && phase === "navigation") return "traversing";
  if (event.type === "TRAVERSAL_COMPLETE" && phase === "traversing") return "revealed";
  if (event.type === "RESET" && phase === "revealed") return "idle";
  return phase;
}

export function loginTransitionIsBlocking(phase: LoginTransitionPhase): boolean {
  return !["idle", "auth_error"].includes(phase);
}
