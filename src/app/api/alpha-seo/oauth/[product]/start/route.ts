import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import { beginGoogleOAuth } from "@/lib/alpha-seo/google/oauth";
import { redactSecrets } from "@/lib/alpha-seo/security";

const productSchema = z.enum(["gsc", "ga4"]);
export async function POST(
  request: Request,
  { params }: { params: Promise<{ product: string }> },
) {
  try {
    const product = productSchema.parse((await params).product);
    const body = z
      .object({ projectId: z.string().min(1) })
      .strict()
      .parse(await request.json());
    const access = await requireAlphaSeoProjectAccess({
      projectId: body.projectId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    const redirectUri = new URL(
      `/api/alpha-seo/oauth/${product}/callback`,
      request.url,
    ).toString();
    const url = await beginGoogleOAuth({
      userId: access.userId,
      projectId: body.projectId,
      product: product.toUpperCase() as "GSC" | "GA4",
      redirectUri,
    });
    return NextResponse.json({ success: true, data: { url } });
  } catch (error) {
    const safe = redactSecrets(
      error instanceof Error ? error.message : "Erro interno",
    );
    return NextResponse.json(
      { success: false, error: safe },
      { status: error instanceof z.ZodError ? 400 : 403 },
    );
  }
}
