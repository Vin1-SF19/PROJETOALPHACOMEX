"use server";
import { z } from "zod";
import db from "@/lib/prisma";
import { safeAlphaSeoActionError } from "@/lib/alpha-seo/action-error";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import {
  getGoogleAccessToken,
  revokeGoogleGrantIfUnused,
} from "@/lib/alpha-seo/google/oauth";
import {
  ga4ReportSchema,
  listGa4Properties,
  runGa4Report,
} from "@/lib/alpha-seo/google/ga4";

export async function ObterConexaoAlphaSeoGa4(projectId: string) {
  try {
    await requireAlphaSeoProjectAccess({
      projectId,
      action: "seo:read",
    });
    const data = await db.alphaSeoGa4Connection.findUnique({
      where: { projectId },
      select: {
        propertyId: true,
        propertyDisplayName: true,
        propertyTimeZone: true,
        propertyCurrencyCode: true,
        connectedAccountEmail: true,
        createdAt: true,
      },
    });
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function ListarPropriedadesAlphaSeoGa4(projectId: string) {
  try {
    const access = await requireAlphaSeoProjectAccess({
      projectId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    const grants = await db.alphaSeoGoogleOAuthGrant.findMany({
      where: { userId: access.userId, product: "GA4", revokedAt: null },
      select: { id: true, accountEmail: true },
    });
    const accounts = [];
    for (const grant of grants)
      accounts.push({
        grantId: grant.id,
        email: grant.accountEmail,
        properties: await listGa4Properties(
          await getGoogleAccessToken(grant.id, access.userId),
        ),
      });
    return { success: true, data: accounts };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function SelecionarPropriedadeAlphaSeoGa4(input: unknown) {
  try {
    const data = z
      .object({
        projectId: z.string().min(1),
        grantId: z.string().min(1),
        propertyId: z.string().regex(/^properties\/\d+$/),
      })
      .strict()
      .parse(input);
    const access = await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    const grant = await db.alphaSeoGoogleOAuthGrant.findFirst({
      where: {
        id: data.grantId,
        userId: access.userId,
        product: "GA4",
        revokedAt: null,
      },
      select: { id: true, accountEmail: true },
    });
    if (!grant) throw new Error("GOOGLE_GRANT_NOT_FOUND");
    const properties = await listGa4Properties(
      await getGoogleAccessToken(grant.id, access.userId),
    );
    const selected = properties.find(
      (property) => property.name === data.propertyId,
    );
    if (!selected) throw new Error("GA4_PROPERTY_NOT_SELECTABLE");
    const row = await db.$transaction(async (tx) => {
      const activeGrant = await tx.alphaSeoGoogleOAuthGrant.findFirst({
        where: {
          id: grant.id,
          userId: access.userId,
          product: "GA4",
          revokedAt: null,
        },
        select: { id: true },
      });
      if (!activeGrant) throw new Error("GOOGLE_GRANT_NOT_FOUND");
      return tx.alphaSeoGa4Connection.upsert({
        where: { projectId: data.projectId },
        create: {
          projectId: data.projectId,
          grantId: grant.id,
          connectedById: access.userId,
          propertyId: selected.name,
          propertyDisplayName: selected.displayName,
          propertyTimeZone: selected.timeZone,
          propertyCurrencyCode: selected.currencyCode,
          connectedAccountEmail: grant.accountEmail,
        },
        update: {
          grantId: grant.id,
          connectedById: access.userId,
          propertyId: selected.name,
          propertyDisplayName: selected.displayName,
          propertyTimeZone: selected.timeZone,
          propertyCurrencyCode: selected.currencyCode,
          connectedAccountEmail: grant.accountEmail,
        },
        select: { propertyId: true, propertyDisplayName: true },
      });
    });
    return { success: true, data: row };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function ConsultarRelatorioAlphaSeoGa4(input: unknown) {
  try {
    const data = z
      .object({
        projectId: z.string().min(1),
        report: ga4ReportSchema,
        startDate: z.string().date(),
        endDate: z.string().date(),
        limit: z.number().int().min(1).max(10000).optional(),
      })
      .strict()
      .parse(input);
    await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "seo:read",
    });
    const connection = await db.alphaSeoGa4Connection.findUnique({
      where: { projectId: data.projectId },
      include: {
        grant: { select: { id: true, userId: true, revokedAt: true } },
      },
    });
    if (!connection || connection.grant.revokedAt)
      throw new Error("GA4_NOT_CONNECTED");
    const result = await runGa4Report(
      await getGoogleAccessToken(connection.grant.id, connection.grant.userId),
      {
        propertyId: connection.propertyId,
        report: data.report,
        startDate: data.startDate,
        endDate: data.endDate,
        limit: data.limit,
      },
    );
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function DesconectarAlphaSeoGa4(projectId: string) {
  try {
    const access = await requireAlphaSeoProjectAccess({
      projectId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    const connection = await db.alphaSeoGa4Connection.findUnique({
      where: { projectId },
      select: { grantId: true, grant: { select: { userId: true } } },
    });
    if (!connection) return { success: true, data: { disconnected: false } };
    await db.alphaSeoGa4Connection.delete({ where: { projectId } });
    if (connection.grant.userId === access.userId)
      await revokeGoogleGrantIfUnused(
        connection.grantId,
        access.userId,
        "GA4",
      );
    return { success: true, data: { disconnected: true } };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
