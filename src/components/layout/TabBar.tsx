'use client';

import React from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pin, X } from 'lucide-react';
import { MODULOS_REGISTRY } from '@/lib/modulos-registry';
import type { PainelTab } from '@/lib/painel-tabs';
import { cn } from '@/lib/utils';

const CAT_DOT: Record<string, string> = {
  operacional: 'bg-blue-500',
  comercial: 'bg-indigo-500',
  financeiro: 'bg-emerald-500',
  pessoas: 'bg-rose-500',
  infra: 'bg-amber-500',
  admin: 'bg-slate-500',
};

const CAT_ACTIVE_TEXT: Record<string, string> = {
  operacional: 'text-blue-300',
  comercial: 'text-indigo-300',
  financeiro: 'text-emerald-300',
  pessoas: 'text-rose-300',
  infra: 'text-amber-300',
  admin: 'text-slate-300',
};

interface SortableTabProps {
  tab: PainelTab;
  isActive: boolean;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
}

function SortableTab({ tab, isActive, onActivate, onClose }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id, disabled: tab.pinned === true });

  const mod = MODULOS_REGISTRY.find(
    (module) => tab.url === module.href || tab.url.startsWith(`${module.href}/`),
  );
  const dotClass = CAT_DOT[mod?.category ?? ''] ?? 'bg-slate-600';
  const activeText = CAT_ACTIVE_TEXT[mod?.category ?? ''] ?? 'text-slate-300';
  const horizontalTransform = transform ? { ...transform, y: 0 } : null;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(horizontalTransform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/tab relative flex h-7 shrink-0 items-center rounded-lg border transition-colors duration-150',
        isActive
          ? cn('border-white/[0.12] bg-white/[0.07]', activeText)
          : 'border-transparent bg-transparent text-slate-600 hover:bg-white/[0.04] hover:text-slate-400',
        isDragging && 'shadow-xl shadow-black/40 ring-1 ring-white/15',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        role="tab"
        aria-selected={isActive}
        aria-label={tab.pinned ? `Abrir aba fixa ${tab.label}` : `Abrir e reorganizar aba ${tab.label}`}
        title={tab.pinned ? tab.label : `${tab.label} — arraste para reorganizar`}
        onClick={() => onActivate(tab.id)}
        className={cn(
          'flex h-full min-w-0 items-center gap-2 rounded-lg pl-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70',
          tab.pinned ? 'cursor-pointer pr-3' : 'cursor-grab pr-1 touch-none active:cursor-grabbing',
        )}
      >
        {tab.pinned ? (
          <Pin
            size={9}
            aria-hidden="true"
            className={cn('shrink-0', isActive ? 'opacity-90' : 'opacity-50')}
            fill="currentColor"
          />
        ) : (
          <>
            <GripVertical
              size={10}
              aria-hidden="true"
              className="-mr-1 shrink-0 opacity-0 transition-opacity group-hover/tab:opacity-50 group-focus-within/tab:opacity-50"
            />
            <span
              aria-hidden="true"
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full transition-opacity',
                dotClass,
                isActive ? 'opacity-100' : 'opacity-40',
              )}
            />
          </>
        )}
        <span className="max-w-[130px] truncate text-[10px] font-black uppercase leading-none tracking-tight">
          {tab.label}
        </span>
      </button>

      {!tab.pinned && (
        <button
          type="button"
          aria-label={`Fechar aba ${tab.label}`}
          title={`Fechar ${tab.label}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onClose(tab.id);
          }}
          className={cn(
            'mr-1 shrink-0 cursor-pointer rounded p-0.5 outline-none transition-all focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-rose-400/70',
            isActive
              ? 'opacity-40 hover:bg-rose-500/10 hover:text-rose-400 hover:opacity-100'
              : 'opacity-0 hover:text-rose-400 group-hover/tab:opacity-60',
          )}
        >
          <X size={9} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

interface TabBarProps {
  tabs: PainelTab[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
}

export function TabBar({ tabs, activeId, onActivate, onClose, onReorder }: TabBarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (tabs.length === 0) return null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    onReorder(String(active.id), String(over.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Para reorganizar uma aba, pressione espaço, use as setas para mover e pressione espaço novamente para soltar.',
        },
      }}
    >
      <SortableContext items={tabs.map((tab) => tab.id)} strategy={horizontalListSortingStrategy}>
        <div
          role="tablist"
          aria-label="Módulos abertos"
          className="flex h-full items-center gap-0.5 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => (
            <SortableTab
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeId}
              onActivate={onActivate}
              onClose={onClose}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
