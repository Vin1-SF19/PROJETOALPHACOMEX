'use client'

import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface FlowButtonProps {
  icon: LucideIcon
  label: string
  active?: boolean
  href?: string
  onClick?: () => void
  className?: string
  /** RGB string, e.g. "59, 130, 246" */
  accent?: string
  /** Cor (RGB) do estado ativo/energizado. Se omitido, usa `accent`. */
  tone?: string
}

export function FlowButton({
  icon: Icon,
  label,
  active = false,
  href,
  onClick,
  className,
  accent = '59, 130, 246',
  tone,
}: FlowButtonProps) {
  const isInteractive = !active
  const toneRgb = tone ?? accent

  const classes = cn(
    'group relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer w-full text-left',
    'border transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
    isInteractive && [
      'bg-white/[0.03] border-white/[0.05] text-slate-400',
      'hover:bg-white/[0.07] hover:border-white/[0.12] hover:text-white hover:translate-x-[2px]',
      'hover:shadow-[0_4px_16px_rgba(0,0,0,0.25)]',
      'active:scale-[0.98] active:shadow-none active:duration-150',
    ],
    className,
  )

  const activeStyle: React.CSSProperties | undefined = active
    ? {
        background: `linear-gradient(180deg, rgba(${toneRgb}, 0.16), rgba(${toneRgb}, 0.05))`,
        borderColor: `rgba(${toneRgb}, 0.42)`,
        color: '#eaf2fb',
        boxShadow: `0 0 0 1px rgba(${toneRgb},0.18) inset, 0 0 24px -6px rgba(${toneRgb},0.4)`,
      }
    : undefined

  const iconStyle: React.CSSProperties | undefined = active
    ? { color: `rgb(${toneRgb})`, filter: `drop-shadow(0 0 6px rgba(${toneRgb},0.65))` }
    : undefined

  const content = (
    <>
      <Icon
        size={16}
        style={activeStyle ? iconStyle : undefined}
        className="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
      />
      <span className="flex-1">{label}</span>

      {/* Decorative arrow — slides in on hover */}
      {isInteractive && (
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 -translate-x-1 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-hover:translate-x-0"
          aria-hidden="true"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </span>
      )}

      {/* Decorative dot — scales in on hover */}
      {isInteractive && (
          <span
            className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full opacity-0 scale-0 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-hover:scale-100"
            style={{ background: `rgb(${toneRgb})` }}
            aria-hidden="true"
          />
      )}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={classes}
        style={activeStyle}
        aria-current={active ? 'page' : undefined}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={classes}
      style={activeStyle}
      aria-current={active ? 'page' : undefined}
    >
      {content}
    </button>
  )
}
