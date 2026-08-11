import { Skeleton } from "@/components/ui/skeleton";

/** Mostrado enquanto o conteúdo de uma nota selecionada ainda está sendo buscado — imita a
 *  forma real do NoteEditor (barra de ferramentas + título + parágrafos) para não haver salto
 *  de layout nem o flash do EstadoVazioNotas durante o fetch. */
export function NoteEditorSkeleton() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-white/5 px-2 py-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-6 rounded-lg" />
        ))}
      </div>

      <div className="px-4 py-2">
        <Skeleton className="h-5 w-1/3" />
      </div>

      <div className="flex-1 space-y-3 px-4 py-3">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  );
}
