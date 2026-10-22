"use client";
import { useOptionalChecklistDrafts } from "./ChecklistDraftGuard";
import { useRef, useState } from "react";
import type { Result } from "@/lib/checklist/types";
import { confirmar, erroChecklist } from "@/lib/checklist/client/types";
export function useChecklistCommand() {
  const drafts = useOptionalChecklistDrafts();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const running = useRef(false),
    intent = useRef<{ key: string; id: string } | null>(null);
  async function run<T>(key: string, command: (mutationId: string) => Promise<Result<T>>): Promise<T | undefined> {
    if (running.current) return;
    const unlock = drafts?.lock();
    running.current = true;
    setBusy(true);
    setError("");
    if (intent.current?.key !== key) intent.current = { key, id: crypto.randomUUID() };
    try {
      const data = await confirmar(command(intent.current.id));
      intent.current = null;
      return data;
    } catch (e) {
      setError(erroChecklist(e));
      return undefined;
    } finally {
      unlock?.();
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}
