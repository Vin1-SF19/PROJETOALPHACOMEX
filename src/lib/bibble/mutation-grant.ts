const MAX_MUTATION_GRANT_TTL_MS = 120_000;

declare const mutationGrantBrand: unique symbol;

/** Referência opaca emitida pelo servidor para uma única mutação em um turno. */
export type BibbleMutationGrant = Readonly<{
  [mutationGrantBrand]: true;
}>;

type MutationGrantState = {
  userId: number;
  requestId: string;
  tool: string;
  expiresAt: number;
  authorizedText: string;
};

export type ConsumedBibbleMutationGrant = Readonly<{
  authorizedText: string;
}>;

const grantStates = new WeakMap<object, MutationGrantState>();

export function issueBibbleMutationGrant(input: MutationGrantState): BibbleMutationGrant {
  const now = Date.now();
  if (
    !Number.isInteger(input.userId)
    || input.userId <= 0
    || !input.requestId.trim()
    || !input.tool.trim()
    || !input.authorizedText.trim()
    || !Number.isFinite(input.expiresAt)
    || input.expiresAt <= now
    || input.expiresAt - now > MAX_MUTATION_GRANT_TTL_MS
  ) {
    throw new Error("Não foi possível emitir a autorização da mutação.");
  }

  const grant = Object.freeze({}) as BibbleMutationGrant;
  grantStates.set(grant, { ...input });
  return grant;
}

export function consumeBibbleMutationGrant(
  grant: BibbleMutationGrant | undefined,
  expected: Pick<MutationGrantState, "userId" | "requestId" | "tool">,
): ConsumedBibbleMutationGrant | null {
  if (!grant || typeof grant !== "object") return null;

  const state = grantStates.get(grant);
  if (!state) return null;

  // Consome antes de validar para que uma tentativa com contexto adulterado
  // também invalide definitivamente a autorização.
  grantStates.delete(grant);

  const valid = state.expiresAt > Date.now()
    && state.userId === expected.userId
    && state.requestId === expected.requestId
    && state.tool === expected.tool;
  return valid ? Object.freeze({ authorizedText: state.authorizedText }) : null;
}
