"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { alphaSeoAccessErrorMessage, requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import { auditIdSchema, auditMutationSchema, auditResultsSchema, startAuditSchema } from "@/lib/alpha-seo/audit/contracts";
import { approveSiteAuditCost, estimateSiteAuditCost, getSiteAuditResults, getSiteAuditStatus, listSiteAudits, removeSiteAudit, startSiteAudit } from "@/lib/alpha-seo/audit/service";
import {
  exportAlphaSeoAuditLighthouseIssues,
  getAlphaSeoAuditLighthouseIssues,
} from "@/lib/alpha-seo/lighthouse/issues";

const path = "/PainelAlpha/AlphaSEO";

export async function EstimarCustoAuditoriaAlphaSeo(raw: unknown) {
  return action(async () => {
    const input = startAuditSchema.parse(raw);
    const access = await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:read" });
    return estimateSiteAuditCost(access, { maxPages: input.maxPages, lighthouseStrategy: input.lighthouseStrategy });
  });
}

export async function AprovarCustoAuditoriaAlphaSeo(raw: unknown) {
  return action(async () => {
    const input = startAuditSchema.parse(raw);
    const access = await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:execute", minimumRole: "EDITOR" });
    return approveSiteAuditCost(access, { maxPages: input.maxPages, lighthouseStrategy: input.lighthouseStrategy });
  });
}

export async function IniciarAuditoriaAlphaSeo(raw: unknown) {
  return action(async () => { const input = startAuditSchema.parse(raw); const access = await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:execute" }); const result = await startSiteAudit({ projectId: input.projectId, userId: access.userId, startUrl: input.startUrl, config: { maxPages: input.maxPages, lighthouseStrategy: input.lighthouseStrategy } }); revalidatePath(path); return result; });
}

export async function ListarAuditoriasAlphaSeo(raw: unknown) {
  return action(async () => { const input = z.object({ projectId: z.string().min(1) }).parse(raw); await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:read" }); return listSiteAudits(input.projectId); });
}

export async function ObterStatusAuditoriaAlphaSeo(raw: unknown) {
  return action(async () => { const input = auditIdSchema.parse(raw); await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:read" }); return getSiteAuditStatus(input.projectId, input.auditId); });
}

export async function ObterResultadosAuditoriaAlphaSeo(raw: unknown) {
  return action(async () => { const input = auditResultsSchema.parse(raw); await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:read" }); return getSiteAuditResults(input); });
}

export async function RemoverAuditoriaAlphaSeo(raw: unknown) {
  return action(async () => { const input = auditMutationSchema.parse(raw); await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:execute" }); const result = await removeSiteAudit(input.projectId, input.auditId, input.mode); revalidatePath(path); return result; });
}

export async function ObterIssuesLighthouseAlphaSeo(raw: unknown) {
  return action(() => getAlphaSeoAuditLighthouseIssues(raw));
}

export async function ExportarIssuesLighthouseAlphaSeo(raw: unknown) {
  return action(() => exportAlphaSeoAuditLighthouseIssues(raw));
}

async function action<T>(operation: () => Promise<T>): Promise<{ success: true; data: T } | { success: false; error: string; details?: unknown }> {
  try { return { success: true, data: await operation() }; }
  catch (error) { if (error instanceof z.ZodError) return { success: false, error: "Dados invalidos", details: error.flatten().fieldErrors }; return { success: false, error: safeMessage(error) }; }
}
function safeMessage(error: unknown) { const accessMessage = alphaSeoAccessErrorMessage(error); if (accessMessage !== "Erro interno do Alpha SEO") return accessMessage; const message = error instanceof Error ? error.message : "Erro interno"; return /^[A-Z0-9_]+$/.test(message) ? message : "Erro interno do Alpha SEO"; }
