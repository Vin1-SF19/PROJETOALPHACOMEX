"use client";

import { put } from "@vercel/blob/client";
import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { explorerFetch, explorerItemViewSchema } from "./types";

const signedPartSchema = z.object({ partNumber: z.number(), url: z.string().url() });
const uploadSessionSchema = z.discriminatedUnion("uploadMode", [
  z.object({ sessionId: z.string(), provider: z.literal("quobjects"), uploadMode: z.literal("presigned-parts"), parts: z.array(signedPartSchema), partSize: z.number(), expiresAt: z.string() }),
  z.object({ sessionId: z.string(), provider: z.literal("vercel-blob"), uploadMode: z.literal("vercel-client"), clientToken: z.string(), pathname: z.string(), partSize: z.number(), expiresAt: z.string() }),
]);
const listedPartsSchema = z.array(z.object({ partNumber: z.number(), etag: z.string(), size: z.number() }));
const cancelledSchema = z.object({ cancelled: z.boolean(), abortPending: z.boolean() });

interface ExplorerUploadProps { path: string; disabled?: boolean; onComplete: () => void; buttonClassName?: string }

async function uploadPartWithRetry(url: string, body: Blob, signal: AbortSignal): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { method: "PUT", body, signal });
      if (response.ok) return response;
      lastResponse = response;
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      if (signal.aborted) throw error;
      if (attempt === 2) throw error;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 300 * 2 ** attempt));
  }
  throw new Error(`Falha no envio da parte${lastResponse ? ` (${lastResponse.status})` : ""}`);
}
export function ExplorerUpload({ path, disabled, onComplete, buttonClassName }: ExplorerUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileName, setFileName] = useState("");

  async function cancelUpload() {
    controllerRef.current?.abort();
    if (sessionRef.current) {
      await explorerFetch(`/api/alpha-explorer/uploads/${sessionRef.current}`, cancelledSchema, { method: "DELETE" }).catch(() => undefined);
    }
    sessionRef.current = null;
    setProgress(null);
    toast.info("Upload cancelado");
  }

  async function sendQuObjects(file: File, session: Extract<z.infer<typeof uploadSessionSchema>, { uploadMode: "presigned-parts" }>, signal: AbortSignal) {
    const partCount = Math.ceil(file.size / session.partSize);
    const completed: Array<{ partNumber: number; etag: string; size: number }> = [];
    let sentBytes = 0;
    for (let offset = 0; offset < partCount; offset += 3) {
      const numbers = Array.from({ length: Math.min(3, partCount - offset) }, (_, index) => offset + index + 1);
      let signed = session.parts.filter((part) => numbers.includes(part.partNumber));
      const missing = numbers.filter((number) => !signed.some((part) => part.partNumber === number));
      if (missing.length) {
        signed = [...signed, ...await explorerFetch(`/api/alpha-explorer/uploads/${session.sessionId}/parts`, z.array(signedPartSchema), {
          method: "POST", body: JSON.stringify({ partNumbers: missing }),
        })];
      }
      const results = await Promise.all(signed.map(async ({ partNumber, url }) => {
        const start = (partNumber - 1) * session.partSize;
        const body = file.slice(start, Math.min(start + session.partSize, file.size));
        const response = await uploadPartWithRetry(url, body, signal);
        let etag = response.headers.get("ETag");
        if (!etag) {
          const listed = await explorerFetch(`/api/alpha-explorer/uploads/${session.sessionId}/parts`, listedPartsSchema);
          etag = listed.find((part) => part.partNumber === partNumber)?.etag ?? null;
        }
        if (!etag) throw new Error(`ETag ausente na parte ${partNumber}`);
        return { partNumber, etag, size: body.size };
      }));
      completed.push(...results);
      sentBytes += results.reduce((total, part) => total + part.size, 0);
      setProgress(Math.round((sentBytes / file.size) * 100));
    }
    await explorerFetch(`/api/alpha-explorer/uploads/${session.sessionId}/complete`, explorerItemViewSchema, {
      method: "POST", body: JSON.stringify({ parts: completed }),
    });
  }

  async function uploadFile(file: File) {
    const controller = new AbortController();
    controllerRef.current = controller;
    setFileName(file.name);
    setProgress(0);
    try {
      const session = await explorerFetch("/api/alpha-explorer/uploads", uploadSessionSchema, {
        method: "POST", body: JSON.stringify({ path, name: file.name, size: file.size, mime: file.type || "application/octet-stream" }),
      });
      sessionRef.current = session.sessionId;
      if (session.uploadMode === "presigned-parts") {
        await sendQuObjects(file, session, controller.signal);
      } else {
        await put(session.pathname, file, {
          access: "private", token: session.clientToken, multipart: true, contentType: file.type || "application/octet-stream",
          abortSignal: controller.signal,
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        });
        await explorerFetch(`/api/alpha-explorer/uploads/${session.sessionId}/complete`, explorerItemViewSchema, { method: "POST", body: "{}" });
      }
      toast.success("Upload concluído");
      onComplete();
    } catch (error) {
      if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "Falha no upload");
    } finally {
      controllerRef.current = null;
      sessionRef.current = null;
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div data-guia-explorer="upload" className="flex items-center gap-2">
      <input ref={inputRef} className="sr-only" type="file" disabled={disabled || progress !== null} onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void uploadFile(file);
      }} />
      <Button disabled={disabled || progress !== null} onClick={() => inputRef.current?.click()} className={cn("rounded-xl", buttonClassName)}><Upload className="mr-2 size-4" />Upload</Button>
      {progress !== null && (
        <div className="min-w-32 flex-1" aria-live="polite">
          <div className="mb-1 flex justify-between text-xs"><span className="max-w-40 truncate">{fileName}</span><span>{progress}%</span></div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 overflow-hidden rounded-full bg-[#07152B]">
            <div className="h-full bg-gradient-to-r from-[#1677FF] to-[#3B97FF] transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {progress !== null && <Button type="button" variant="ghost" size="icon" aria-label="Cancelar upload" onClick={() => void cancelUpload()}><X className="size-4" /></Button>}
    </div>
  );
}
