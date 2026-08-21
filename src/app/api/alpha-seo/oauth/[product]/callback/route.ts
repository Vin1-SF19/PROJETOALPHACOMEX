import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import {
  consumeGoogleOAuth,
  resolveGoogleOAuthState,
} from "@/lib/alpha-seo/google/oauth";
import { redactSecrets } from "@/lib/alpha-seo/security";

const querySchema = z
  .object({ state: z.string().min(20), code: z.string().min(1) })
  .strict();
export async function GET(
  request: Request,
  { params }: { params: Promise<{ product: string }> },
) {
  try {
    const product = z.enum(["gsc", "ga4"]).parse((await params).product);
    const url = new URL(request.url);
    const data = querySchema.parse({
      state: url.searchParams.get("state"),
      code: url.searchParams.get("code"),
    });
    const googleProduct = product.toUpperCase() as "GSC" | "GA4";
    const nonce = await resolveGoogleOAuthState(data.state, googleProduct);
    const access = await requireAlphaSeoProjectAccess({
      projectId: nonce.projectId,
      userId: nonce.userId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    const redirectUri = new URL(
      `/api/alpha-seo/oauth/${product}/callback`,
      request.url,
    ).toString();
    await consumeGoogleOAuth({
      userId: access.userId,
      projectId: nonce.projectId,
      product: googleProduct,
      redirectUri,
      state: data.state,
      code: data.code,
    });
    return NextResponse.redirect(
      new URL(
        `/PainelAlpha/AlphaSEO?projectId=${encodeURIComponent(nonce.projectId)}&integration=${product}&connected=1`,
        request.url,
      ),
      303,
    );
  } catch (error) {
    const safe = String(
      redactSecrets(error instanceof Error ? error.message : "Erro interno"),
    );
    return NextResponse.json(
      { success: false, error: safe },
      { status: error instanceof z.ZodError ? 400 : 403 },
    );
  }
}
