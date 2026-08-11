"use client";

import { useState } from "react";
import { Table as TableIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MAX_LINHAS = 8;
const MAX_COLUNAS = 8;

interface TableSizePickerProps {
  onEscolher: (linhas: number, colunas: number) => void;
}

/**
 * Grid de seleção de tamanho da tabela ao estilo Word/Excel (Inserir > Tabela) — passar o
 * mouse sobre as células destaca a seleção "N x M" atual, o clique insere com esse tamanho.
 * Substitui o antigo botão fixo que sempre inseria 3x3.
 */
export function TableSizePicker({ onEscolher }: TableSizePickerProps) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ linhas: number; colunas: number } | null>(null);

  const linhasAtivas = hover?.linhas ?? 0;
  const colunasAtivas = hover?.colunas ?? 0;

  return (
    <Popover
      open={open}
      onOpenChange={(novoOpen) => {
        setOpen(novoOpen);
        if (!novoOpen) setHover(null);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Tabela"
          className={cn(
            "flex h-7 items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white",
            open && "bg-white/10 text-white",
          )}
        >
          <TableIcon size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto border-white/10 bg-[#0b1120] p-3"
        onCloseAutoFocus={(event) => {
          // O Radix devolve o foco ao trigger por padrão ao fechar — isso compete com o
          // editor.focus() disparado por onEscolher (chamado logo depois de setOpen(false)),
          // e o "cabo de guerra" pelo foco deixava o Popover preso em open=true.
          event.preventDefault();
        }}
      >
        <p className="mb-2 text-center text-[11px] font-medium text-slate-300">
          {hover ? `${hover.linhas} × ${hover.colunas}` : "Inserir tabela"}
        </p>
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${MAX_COLUNAS}, 16px)` }}
          onMouseLeave={() => setHover(null)}
        >
          {Array.from({ length: MAX_LINHAS * MAX_COLUNAS }).map((_, index) => {
            const linha = Math.floor(index / MAX_COLUNAS) + 1;
            const coluna = (index % MAX_COLUNAS) + 1;
            const ativa = linha <= linhasAtivas && coluna <= colunasAtivas;
            return (
              <button
                key={index}
                type="button"
                onMouseEnter={() => setHover({ linhas: linha, colunas: coluna })}
                onClick={() => {
                  setOpen(false);
                  setHover(null);
                  onEscolher(linha, coluna);
                }}
                className={cn(
                  "h-4 w-4 rounded-[2px] border transition-colors",
                  ativa ? "border-amber-400/60 bg-amber-400/40" : "border-white/10 bg-white/[0.03]",
                )}
                aria-label={`${linha} por ${coluna}`}
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
