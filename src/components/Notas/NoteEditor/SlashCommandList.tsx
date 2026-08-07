import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { SuggestionKeyDownProps } from "@tiptap/suggestion";
import { cn } from "@/lib/utils";

export interface SlashCommandItem {
  title: string;
  comando: (editor: Editor) => void;
}

export interface SlashCommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  function SlashCommandList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev + items.length - 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === "Enter") {
          if (items[selectedIndex]) command(items[selectedIndex]);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-xl border border-white/10 bg-[#0b1120] p-2 text-xs text-slate-500 shadow-2xl">
          Nenhum comando encontrado
        </div>
      );
    }

    return (
      <div className="flex max-h-64 w-56 flex-col overflow-y-auto rounded-xl border border-white/10 bg-[#0b1120] p-1 shadow-2xl">
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => command(item)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-left text-sm text-slate-300 transition-colors",
              index === selectedIndex ? "bg-white/10 text-white" : "hover:bg-white/5",
            )}
          >
            {item.title}
          </button>
        ))}
      </div>
    );
  },
);
