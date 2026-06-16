'use client';

import React from 'react';
import { X, Pin } from 'lucide-react';
import { MODULOS_REGISTRY } from '@/lib/modulos-registry';

export type Tab = { id: string; url: string; label: string; pinned?: boolean; };

const CAT_DOT: Record<string, string> = {
  operacional: 'bg-blue-500',
  comercial:   'bg-indigo-500',
  financeiro:  'bg-emerald-500',
  pessoas:     'bg-rose-500',
  infra:       'bg-amber-500',
  admin:       'bg-slate-500',
};

const CAT_ACTIVE_TEXT: Record<string, string> = {
  operacional: 'text-blue-300',
  comercial:   'text-indigo-300',
  financeiro:  'text-emerald-300',
  pessoas:     'text-rose-300',
  infra:       'text-amber-300',
  admin:       'text-slate-300',
};

interface TabBarProps {
  tabs: Tab[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
}

export default function TabBar({ tabs, activeId, onActivate, onClose }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 px-2 h-full overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
      {tabs.map(tab => {
        const mod = MODULOS_REGISTRY.find(m => tab.url === m.href || tab.url.startsWith(m.href + '/'));
        const dotClass = CAT_DOT[mod?.category ?? ''] ?? 'bg-slate-600';
        const activeText = CAT_ACTIVE_TEXT[mod?.category ?? ''] ?? 'text-slate-300';
        const isActive = tab.id === activeId;

        return (
          <button
            key={tab.id}
            onClick={() => onActivate(tab.id)}
            className={`
              flex items-center gap-2 px-3 h-7 rounded-lg border transition-all duration-150 shrink-0 group/tab relative cursor-pointer
              ${isActive
                ? `bg-white/[0.07] border-white/[0.12] ${activeText}`
                : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400 hover:bg-white/[0.04]'}
            `}
          >
            {tab.pinned ? (
              <Pin size={9} className={`shrink-0 ${isActive ? 'opacity-90' : 'opacity-50'}`} fill="currentColor" />
            ) : (
              <div
                className={`w-1.5 h-1.5 rounded-full shrink-0 transition-opacity ${dotClass} ${isActive ? 'opacity-100' : 'opacity-40'}`}
              />
            )}
            <span className="text-[10px] font-black uppercase tracking-tight max-w-[130px] truncate leading-none">
              {tab.label}
            </span>
            {!tab.pinned && (
              <span
                onClick={e => { e.stopPropagation(); onClose(tab.id); }}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onClose(tab.id))}
                className={`
                  ml-0.5 shrink-0 rounded p-0.5 transition-all cursor-pointer
                  ${isActive
                    ? 'opacity-40 hover:opacity-100 hover:text-rose-400 hover:bg-rose-500/10'
                    : 'opacity-0 group-hover/tab:opacity-60 hover:text-rose-400'}
                `}
              >
                <X size={9} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
