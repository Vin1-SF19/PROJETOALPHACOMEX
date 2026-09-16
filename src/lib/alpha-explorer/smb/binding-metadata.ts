import "server-only";

import db from "@/lib/prisma";

export interface SmbGatewayBindingStatus {
  linked: boolean;
  principal: string | null;
  principalKey: string | null;
  secretRef: string | null;
  credentialVersion: number;
}

export async function reconcileSmbBindingMetadata(input: {
  targetUserId: number;
  actorUserId: number;
  status: SmbGatewayBindingStatus;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  if (!input.status.linked) {
    await db.alphaExplorerSmbBinding.updateMany({
      where: { userId: input.targetUserId, status: { not: "REVOKED" } },
      data: { status: "REVOKED", revokedAt: now, updatedById: input.actorUserId },
    });
    return;
  }

  const { principal, principalKey, secretRef, credentialVersion } = input.status;
  if (!principal || !principalKey || !secretRef || credentialVersion <= 0) {
    throw new Error("SMB_BINDING_METADATA_INCOMPLETE");
  }

  await db.alphaExplorerSmbBinding.upsert({
    where: { userId: input.targetUserId },
    create: {
      userId: input.targetUserId,
      qnapPrincipal: principal,
      qnapPrincipalKey: principalKey,
      secretRef,
      status: "ACTIVE",
      credentialVersion,
      lastValidatedAt: now,
      lastRotatedAt: credentialVersion > 1 ? now : null,
      createdById: input.actorUserId,
      updatedById: input.actorUserId,
    },
    update: {
      qnapPrincipal: principal,
      qnapPrincipalKey: principalKey,
      secretRef,
      status: "ACTIVE",
      credentialVersion,
      lastValidatedAt: now,
      lastRotatedAt: credentialVersion > 1 ? now : undefined,
      revokedAt: null,
      updatedById: input.actorUserId,
    },
  });
}
