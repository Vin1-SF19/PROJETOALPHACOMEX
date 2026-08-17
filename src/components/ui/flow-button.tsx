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
}

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

export function FlowButton({
  icon: Icon,
  label,
  active = false,
  href,
  onClick,
  className,
  accent = '59, 130, 246',
}: FlowButtonProps) {
  const isInteractive = !active

  const classes = cn(
    'group relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer w-full text-left',
    'border transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
    isInteractive && [
      'bg-white/[0.03] border-white/[0.05] text-slate-400',
      'hover:bg-white/[0.07] hover:border-white/[0.12] hover:text-white',
      'hover:shadow-[0_4px_16px_rgba(0,0,0,0.25)]',
      'active:scale-[0.97] active:shadow-none active:duration-150',
    ],
    className,
  )

  const activeStyle: React.CSSProperties | undefined = active
    ? {
        background: `rgba(${accent}, 0.1)`,
        borderColor: `rgba(${accent}, 0.25)`,
        color: `rgb(${accent})`,
        boxShadow: `0 0 20px rgba(${accent}, 0.06)`,
      }
    : undefined

  const content = (
    <>
      <Icon
        size={16}
        className="shrink-0 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
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
          className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full opacity-0 scale-0 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-hover:scale-100"
          style={{ background: `rgb(${accent})` }}
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
