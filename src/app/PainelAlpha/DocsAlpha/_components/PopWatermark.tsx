'use client'

interface Props {
  userName: string
}

export function PopWatermark({ userName }: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden flex flex-wrap gap-14 p-8 rotate-[-15deg] opacity-[0.06] z-10 select-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <span key={i} className="text-red-400 font-black text-base uppercase whitespace-nowrap">
          {userName} • ACESSO RESTRITO
        </span>
      ))}
    </div>
  )
}
