import { FileText } from "lucide-react";

export function DocumentosLoading({ variant = "cards" }: { variant?: "cards" | "editor" | "form" | "review" }) {
  return (
    <main className="gd-main" aria-busy="true" aria-label="Carregando Gerador de Documentos">
      <div className="gd-breadcrumb"><FileText size={14} /> Gerador de Documentos <span aria-hidden> / </span> Carregando</div>
      <div className="gd-panel mb-6 rounded-3xl p-6 sm:p-8">
        <div className="gd-skeleton mb-4 h-3 w-28 rounded-full" />
        <div className="gd-skeleton mb-3 h-9 w-3/5 max-w-lg rounded-xl" />
        <div className="gd-skeleton h-4 w-4/5 max-w-xl rounded-lg" />
      </div>
      {variant === "cards" ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="gd-panel rounded-2xl p-6">
            <div className="gd-skeleton mb-7 size-11 rounded-xl" />
            <div className="gd-skeleton mb-3 h-5 w-4/5 rounded-lg" />
            <div className="gd-skeleton mb-6 h-4 w-full rounded-lg" />
            <div className="gd-skeleton h-9 w-2/3 rounded-lg" />
          </div>)}
        </div>
      ) : (
        <div className={`grid gap-5 ${variant === "review" ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "lg:grid-cols-[220px_minmax(0,1fr)]"}`}>
          <div className="gd-panel rounded-2xl p-5"><div className="gd-skeleton mb-5 h-5 w-3/4 rounded-lg" /><div className="gd-skeleton mb-3 h-10 rounded-lg" /><div className="gd-skeleton mb-3 h-10 rounded-lg" /><div className="gd-skeleton h-10 rounded-lg" /></div>
          <div className="gd-panel rounded-2xl p-6"><div className="gd-skeleton mb-5 h-6 w-2/3 rounded-lg" /><div className="gd-skeleton mb-4 h-12 rounded-lg" /><div className="gd-skeleton mb-4 h-32 rounded-lg" /><div className="gd-skeleton h-12 rounded-lg" /></div>
        </div>
      )}
      <span className="sr-only" role="status">Carregando dados do Gerador de Documentos…</span>
    </main>
  );
}
