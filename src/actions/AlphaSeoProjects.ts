"use server";

import { revalidatePath } from "next/cache";
import { safeAlphaSeoActionError } from "@/lib/alpha-seo/action-error";
import {
  acceptAlphaSeoProjectInvitation,
  archiveAlphaSeoProject,
  createAlphaSeoProject,
  inviteAlphaSeoProjectMember,
  listAlphaSeoProjectMembers,
  listAlphaSeoProjects,
  removeAlphaSeoProjectMember,
  restoreAlphaSeoProject,
  revokeAlphaSeoProjectInvitation,
  transferAlphaSeoProjectOwnership,
  updateAlphaSeoProject,
  updateAlphaSeoProjectMember,
} from "@/lib/alpha-seo/projects/service";

const BASE_PATH = "/PainelAlpha/AlphaSEO";
type ActionResult =
  { success: true; data: unknown } | { success: false; error: string };

async function runAction(
  operation: () => Promise<unknown>,
  revalidate = false,
): Promise<ActionResult> {
  try {
    const data = await operation();
    if (revalidate) revalidatePath(BASE_PATH);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}

export async function ListarProjetosAlphaSeo(input?: unknown) {
  return runAction(() => listAlphaSeoProjects(input));
}
export async function CriarProjetoAlphaSeo(input: unknown) {
  return runAction(() => createAlphaSeoProject(input), true);
}
export async function AtualizarProjetoAlphaSeo(input: unknown) {
  return runAction(() => updateAlphaSeoProject(input), true);
}
export async function ArquivarProjetoAlphaSeo(input: unknown) {
  return runAction(() => archiveAlphaSeoProject(input), true);
}
export async function RestaurarProjetoAlphaSeo(input: unknown) {
  return runAction(() => restoreAlphaSeoProject(input), true);
}
export async function ListarMembrosProjetoAlphaSeo(input: unknown) {
  return runAction(() => listAlphaSeoProjectMembers(input));
}
export async function ConvidarMembroProjetoAlphaSeo(input: unknown) {
  return runAction(() => inviteAlphaSeoProjectMember(input), true);
}
export async function AceitarConviteProjetoAlphaSeo(input: unknown) {
  return runAction(() => acceptAlphaSeoProjectInvitation(input), true);
}
export async function AtualizarMembroProjetoAlphaSeo(input: unknown) {
  return runAction(() => updateAlphaSeoProjectMember(input), true);
}
export async function RemoverMembroProjetoAlphaSeo(input: unknown) {
  return runAction(() => removeAlphaSeoProjectMember(input), true);
}
export async function TransferirPropriedadeProjetoAlphaSeo(input: unknown) {
  return runAction(() => transferAlphaSeoProjectOwnership(input), true);
}
export async function RevogarConviteProjetoAlphaSeo(input: unknown) {
  return runAction(() => revokeAlphaSeoProjectInvitation(input), true);
}
