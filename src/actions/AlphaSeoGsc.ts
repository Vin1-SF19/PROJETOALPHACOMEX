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
  gscSearchSchema,
  inspectGscUrl,
  listGscSites,
  previousPeriod,
  queryGsc,
  rowsToCsv,
  searchTotals,
  strikingDistance,
} from "@/lib/alpha-seo/google/gsc";

export async function ObterConexaoAlphaSeoGsc(projectId: string) {
  try {
    const access = await requireAlphaSeoProjectAccess({
      projectId,
      action: "seo:read",
    });
    const connection = await db.alphaSeoGscConnection.findUnique({
      where: { projectId },
      select: {
        siteUrl: true,
        connectedAccountEmail: true,
        createdAt: true,
        grant: { select: { userId: true, revokedAt: true } },
      },
    });
    return {
      success: true,
      data: connection
        ? {
            siteUrl: connection.siteUrl,
            email: connection.connectedAccountEmail,
            createdAt: connection.createdAt,
            revoked: Boolean(connection.grant.revokedAt),
            ownGrant: connection.grant.userId === access.userId,
          }
        : null,
    };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function ConsultarOverviewAlphaSeoGsc(input: unknown) {
  try {
    const data = z
      .object({
        projectId: z.string().min(1),
        startDate: z.string().date(),
        endDate: z.string().date(),
        device: z.enum(["DESKTOP", "MOBILE", "TABLET"]).optional(),
        country: z.string().min(3).max(3).optional(),
      })
      .strict()
      .refine((value) => value.startDate <= value.endDate)
      .parse(input);
    await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "seo:read",
    });
    const connection = await db.alphaSeoGscConnection.findUnique({
      where: { projectId: data.projectId },
      include: {
        grant: { select: { id: true, userId: true, revokedAt: true } },
      },
    });
    if (!connection || connection.grant.revokedAt)
      throw new Error("GSC_NOT_CONNECTED");
    const token = await getGoogleAccessToken(
      connection.grant.id,
      connection.grant.userId,
    );
    const baseFilters = [
      ...(data.device
        ? [
            {
              dimension: "device" as const,
              operator: "equals" as const,
              expression: data.device,
            },
          ]
        : []),
      ...(data.country
        ? [
            {
              dimension: "country" as const,
              operator: "equals" as const,
              expression: data.country,
            },
          ]
        : []),
    ];
    const previous = previousPeriod(data.startDate, data.endDate);
    const [currentRows, previousRows, queryPageRows, countryRows] =
      await Promise.all([
        queryGsc(token, {
          siteUrl: connection.siteUrl,
          startDate: data.startDate,
          endDate: data.endDate,
          dimensions: ["date"],
          filters: baseFilters,
          rowLimit: 200,
        }),
        queryGsc(token, {
          siteUrl: connection.siteUrl,
          ...previous,
          dimensions: ["date"],
          filters: baseFilters,
          rowLimit: 200,
        }),
        queryGsc(token, {
          siteUrl: connection.siteUrl,
          startDate: data.startDate,
          endDate: data.endDate,
          dimensions: ["query", "page"],
          filters: baseFilters,
          rowLimit: 1000,
        }),
        queryGsc(token, {
          siteUrl: connection.siteUrl,
          startDate: data.startDate,
          endDate: data.endDate,
          dimensions: ["country"],
          filters: baseFilters.filter(
            (filter) => filter.dimension !== "country",
          ),
          rowLimit: 25,
        }),
      ]);
    return {
      success: true,
      data: {
        range: {
          startDate: data.startDate,
          endDate: data.endDate,
          previousStartDate: previous.startDate,
          previousEndDate: previous.endDate,
        },
        totals: searchTotals(currentRows),
        previousTotals: searchTotals(previousRows),
        strikingDistance: strikingDistance(queryPageRows),
        countries: countryRows,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function ListarSitesAlphaSeoGsc(projectId: string) {
  try {
    const access = await requireAlphaSeoProjectAccess({
      projectId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    const grants = await db.alphaSeoGoogleOAuthGrant.findMany({
      where: { userId: access.userId, product: "GSC", revokedAt: null },
      select: { id: true, accountEmail: true, accessTokenCiphertext: true },
    });
    const accounts = [];
    for (const grant of grants) {
      const token = await getGoogleAccessToken(grant.id, access.userId);
      accounts.push({
        grantId: grant.id,
        email: grant.accountEmail,
        sites: await listGscSites(token),
      });
    }
    return { success: true, data: accounts };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function SelecionarSiteAlphaSeoGsc(input: unknown) {
  try {
    const data = z
      .object({
        projectId: z.string().min(1),
        grantId: z.string().min(1),
        siteUrl: z.string().min(1).max(2048),
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
        product: "GSC",
        revokedAt: null,
      },
      select: { id: true, accountEmail: true },
    });
    if (!grant) throw new Error("GOOGLE_GRANT_NOT_FOUND");
    const sites = await listGscSites(
      await getGoogleAccessToken(grant.id, access.userId),
    );
    const selected = sites.find(
      (site) =>
        site.siteUrl === data.siteUrl &&
        site.permissionLevel !== "siteUnverifiedUser",
    );
    if (!selected) throw new Error("GSC_SITE_NOT_SELECTABLE");
    const row = await db.$transaction(async (tx) => {
      const activeGrant = await tx.alphaSeoGoogleOAuthGrant.findFirst({
        where: {
          id: grant.id,
          userId: access.userId,
          product: "GSC",
          revokedAt: null,
        },
        select: { id: true },
      });
      if (!activeGrant) throw new Error("GOOGLE_GRANT_NOT_FOUND");
      return tx.alphaSeoGscConnection.upsert({
        where: { projectId: data.projectId },
        create: {
          projectId: data.projectId,
          grantId: grant.id,
          connectedById: access.userId,
          siteUrl: selected.siteUrl,
          connectedAccountEmail: grant.accountEmail,
        },
        update: {
          grantId: grant.id,
          connectedById: access.userId,
          siteUrl: selected.siteUrl,
          connectedAccountEmail: grant.accountEmail,
        },
        select: { siteUrl: true },
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
export async function ConsultarPerformanceAlphaSeoGsc(input: unknown) {
  try {
    const data = z
      .object({ projectId: z.string().min(1), query: gscSearchSchema })
      .strict()
      .parse(input);
    await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "seo:read",
    });
    const connection = await db.alphaSeoGscConnection.findUnique({
      where: { projectId: data.projectId },
      include: {
        grant: { select: { id: true, userId: true, revokedAt: true } },
      },
    });
    if (!connection || connection.grant.revokedAt)
      throw new Error("GSC_NOT_CONNECTED");
    if (data.query.siteUrl !== connection.siteUrl)
      throw new Error("GSC_SITE_MISMATCH");
    const token = await getGoogleAccessToken(
      connection.grant.id,
      connection.grant.userId,
    );
    const rows = await queryGsc(token, data.query);
    return {
      success: true,
      data: {
        rows,
        totals: searchTotals(rows),
        strikingDistance: strikingDistance(rows),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function ExportarPerformanceAlphaSeoGsc(input: unknown) {
  const result = await ConsultarPerformanceAlphaSeoGsc(input);
  return result.success && result.data
    ? { success: true, data: { csv: rowsToCsv(result.data.rows) } }
    : result;
}
export async function InspecionarUrlAlphaSeoGsc(input: unknown) {
  try {
    const data = z
      .object({ projectId: z.string().min(1), url: z.string().url().max(2048) })
      .strict()
      .parse(input);
    await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "seo:read",
    });
    const connection = await db.alphaSeoGscConnection.findUnique({
      where: { projectId: data.projectId },
      include: {
        grant: { select: { id: true, userId: true, revokedAt: true } },
      },
    });
    if (!connection || connection.grant.revokedAt)
      throw new Error("GSC_NOT_CONNECTED");
    return {
      success: true,
      data: await inspectGscUrl(
        await getGoogleAccessToken(
          connection.grant.id,
          connection.grant.userId,
        ),
        connection.siteUrl,
        data.url,
      ),
    };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function DesconectarAlphaSeoGsc(projectId: string) {
  try {
    const access = await requireAlphaSeoProjectAccess({
      projectId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    const connection = await db.alphaSeoGscConnection.findUnique({
      where: { projectId },
      select: { grantId: true, grant: { select: { userId: true } } },
    });
    if (!connection) return { success: true, data: { disconnected: false } };
    await db.alphaSeoGscConnection.delete({ where: { projectId } });
    if (connection.grant.userId === access.userId)
      await revokeGoogleGrantIfUnused(
        connection.grantId,
        access.userId,
        "GSC",
      );
    return { success: true, data: { disconnected: true } };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
