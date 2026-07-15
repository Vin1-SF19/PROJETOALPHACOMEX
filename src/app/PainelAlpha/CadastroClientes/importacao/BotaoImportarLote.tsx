"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { ModalImportacaoLote } from "./ModalImportacaoLote";

interface BotaoImportarLoteProps {
  onImportado: () => void | Promise<void>;
}

export function BotaoImportarLote({ onImportado }: BotaoImportarLoteProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-slate-700 active:scale-95"
      >
        <FileUp size={16} aria-hidden="true" /> Importar em lote
      </button>
      <ModalImportacaoLote open={open} onOpenChange={setOpen} onImportado={onImportado} />
    </>
  );
}

