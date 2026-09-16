"use client";

import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadSmbFile } from "@/lib/alpha-explorer/smb/browser-client";
import { friendlySmbErrorMessage } from "@/lib/alpha-explorer/smb/error-messages";
import { cn } from "@/lib/utils";

interface SmbExplorerUploadProps {
  parentHandle: string;
  disabled?: boolean;
  onComplete: () => void;
  buttonClassName?: string;
}

export function SmbExplorerUpload({ parentHandle, disabled, onComplete, buttonClassName }: SmbExplorerUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileName, setFileName] = useState("");

  async function send(file: File) {
    const controller = new AbortController();
    controllerRef.current = controller;
    setFileName(file.name);
    setProgress(0);
    try {
      await uploadSmbFile({
        parentHandle,
        file,
        signal: controller.signal,
        onProgress: ({ sentBytes, totalBytes }) => setProgress(totalBytes === 0 ? 100 : Math.round((sentBytes / totalBytes) * 100)),
      });
      toast.success("Upload concluído no NAS");
      onComplete();
    } catch (error) {
      if (!controller.signal.aborted) toast.error(friendlySmbErrorMessage(error));
    } finally {
      controllerRef.current = null;
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div data-guia-explorer="upload" className="flex items-center gap-2">
      <input ref={inputRef} className="sr-only" type="file" disabled={disabled || progress !== null} onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void send(file);
      }} />
      <Button disabled={disabled || progress !== null} onClick={() => inputRef.current?.click()} className={cn("rounded-xl", buttonClassName)}>
        <Upload className="mr-2 size-4" />Upload
      </Button>
      {progress !== null && (
        <div className="min-w-32 flex-1" aria-live="polite">
          <div className="mb-1 flex justify-between text-xs"><span className="max-w-40 truncate">{fileName}</span><span>{progress}%</span></div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {progress !== null && (
        <Button type="button" variant="ghost" size="icon" aria-label="Cancelar upload" onClick={() => controllerRef.current?.abort()}>
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
