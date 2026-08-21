import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/prisma";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import { redactSecrets } from "@/lib/alpha-seo/security";
import {
  isSamAbortError,
  runSamTurn,
  samMessageSchema,
} from "@/lib/alpha-seo/sam/service";

export async function POST(request: Request) {
  let data: z.infer<typeof samMessageSchema>;
  try {
    data = samMessageSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Dados inválidos",
        details:
          error instanceof z.ZodError ? error.flatten().fieldErrors : undefined,
      },
      { status: 400 },
    );
  }
  try {
    const access = await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    const project = await db.alphaSeoProject.findUnique({
      where: { id: data.projectId },
      select: { domain: true },
    });
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    const encoder = new TextEncoder();
    const execution = new AbortController();
    let closed = false;
    let cancellationPersistence: Promise<void> | null = null;
    const cancelExecution = () => {
      closed = true;
      if (!execution.signal.aborted)
        execution.abort(new DOMException("SSE client disconnected", "AbortError"));
      cancellationPersistence ??= db.alphaSeoSamSession
        .updateMany({
          where: {
            id: data.sessionId,
            projectId: data.projectId,
            userId: access.userId,
            status: "ACTIVE",
          },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        })
        .then(() => undefined)
        .catch(() => undefined);
      return cancellationPersistence;
    };
    const onRequestAbort = () => void cancelExecution();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: { type: string; data: unknown }) => {
          if (!closed)
            controller.enqueue(
              encoder.encode(
                `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`,
              ),
            );
        };
        request.signal.addEventListener("abort", onRequestAbort, { once: true });
        if (request.signal.aborted) void cancelExecution();
        void runSamTurn({
          userId: access.userId,
          data,
          projectDomain: project.domain,
          onDelta: send,
          signal: execution.signal,
        })
          .then((result) => {
            send({ type: "done", data: result });
            if (!closed) {
              closed = true;
              controller.close();
            }
          })
          .catch((error) => {
            if (execution.signal.aborted || isSamAbortError(error)) return;
            send({
              type: "error",
              data: {
                error: redactSecrets(
                  error instanceof Error ? error.message : "SAM_FAILED",
                ),
              },
            });
            if (!closed) {
              closed = true;
              controller.close();
            }
          })
          .finally(() =>
            request.signal.removeEventListener("abort", onRequestAbort),
          );
      },
      cancel() {
        return cancelExecution();
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-content-type-options": "nosniff",
        connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: redactSecrets(
          error instanceof Error ? error.message : "Erro interno",
        ),
      },
      { status: 403 },
    );
  }
}
