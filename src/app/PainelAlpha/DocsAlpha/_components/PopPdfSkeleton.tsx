'use client'

export function PopPdfSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <div className="w-[480px] h-[680px] max-w-full bg-slate-800/50 rounded-xl animate-pulse" />
      <div className="flex gap-3">
        <div className="w-20 h-6 bg-slate-800/50 rounded-lg animate-pulse" />
        <div className="w-16 h-6 bg-slate-800/50 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}
