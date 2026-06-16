"use client";

import { ChevronDown } from "lucide-react";

export default function BibbleScrollToBottom({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center text-[#a5b4fc] hover:text-[#fff] transition-all shadow-lg"
      style={{
        background: "#0d1526",
        border: "1px solid rgba(99,102,241,0.35)",
        boxShadow: "0 0 12px rgba(99,102,241,0.2)",
      }}
      aria-label="Rolar para o final"
    >
      <ChevronDown size={16} />
    </button>
  );
}
