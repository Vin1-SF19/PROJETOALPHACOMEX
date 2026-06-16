"use client";

import { ChevronDown } from "lucide-react";

export default function BibbleScrollToBottom({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all shadow-lg"
      aria-label="Rolar para o final"
    >
      <ChevronDown size={16} />
    </button>
  );
}
