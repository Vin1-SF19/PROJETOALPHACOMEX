"use client";

import { useState } from "react";
import { Pencil, Check, X, Trash2 } from "lucide-react";
import { getModelLabel, PROVIDER_MODELS } from "@/lib/bibble/client";
import type { Provider } from "@/lib/bibble/client";
import { cn } from "@/lib/utils";

const PROVIDER_COLOR: Record<Provider, string> = {
  ollama:    "#6b7280",
  openai:    "#10a37f",
  anthropic: "#d4703a",
  google:    "#4285f4",
};

function getModelProvider(modelId: string): Provider {
  const found = Object.values(PROVIDER_MODELS).flat().find(m => m.id === modelId);
  return found?.provider ?? "ollama";
}

interface BibbleChatHeaderProps {
  title: string;
  model: string;
  onRename: (title: string) => void;
  onDelete: () => void;
}

export default function BibbleChatHeader({
  title,
  model,
  onRename,
  onDelete,
}: BibbleChatHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  const confirm = () => {
    if (draft.trim()) onRename(draft.trim());
    setEditing(false);
  };
  const cancel = () => { setDraft(title); setEditing(false); };

  const provider = getModelProvider(model);
  const providerColor = PROVIDER_COLOR[provider];
  const modelLabel = getModelLabel(model);

  return (
    <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border">

      <div className="flex items-center gap-2 min-w-0 flex-1">
        {editing ? (
          <>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") confirm();
                if (e.key === "Escape") cancel();
              }}
              autoFocus
              className="bg-muted/30 border border-border rounded-lg px-2.5 py-1 text-[12px] font-medium text-foreground outline-none w-52"
            />
            <button
              onClick={confirm}
              className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <Check size={12} />
            </button>
            <button
              onClick={cancel}
              className="p-1 rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <span className="text-[13px] font-semibold text-foreground/80 truncate max-w-[260px]">
              {title}
            </span>
            <button
              onClick={() => { setDraft(title); setEditing(true); }}
              className="p-1 rounded-lg text-muted-foreground/30 hover:text-foreground transition-colors"
            >
              <Pencil size={10} />
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Model pill */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border",
          )}
        >
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: providerColor }} />
          <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
            {modelLabel.split(" ")[0]}
          </span>
        </div>

        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Excluir conversa"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
