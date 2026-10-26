"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PausaSessaoDialogProps {
  children: ReactNode;
  onRetry: () => void;
}

/**
 * Native modal top layer also pauses portals outside the React content wrapper.
 * Existing Radix dialogs keep their state, focus scopes and drafts mounted.
 */
export function PausaSessaoDialog({ children, onRetry }: PausaSessaoDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const retryRef = useRef(onRetry);
  useLayoutEffect(() => { retryRef.current = onRetry; }, [onRetry]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Radix listens at document (some listeners use capture). A native modal
    // alone cannot pause those scopes or their Escape/outside-dismiss handlers.
    // Window capture runs before them. Preserve Tab navigation and explicitly
    // delegate this button's click/Enter/Space while React delegation is paused.
    const retryButton = (target: EventTarget | null) => {
      const button = target instanceof Element ? target.closest<HTMLButtonElement>("button[data-alpha-session-retry]") : null;
      return button && dialog.contains(button) && !button.disabled && button.getAttribute("aria-disabled") !== "true" ? button : null;
    };
    let spaceTarget: HTMLButtonElement | null = null;
    const isolate = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") event.preventDefault();
        const button = retryButton(event.target);
        if (event.type === "keydown" && event.key === "Enter" && button) {
          event.preventDefault();
          if (!event.repeat) retryRef.current();
        }
        if (event.key === " " || event.code === "Space") {
          event.preventDefault();
          if (event.type === "keydown" && !event.repeat) spaceTarget = button;
          if (event.type === "keyup") {
            if (button && button === spaceTarget) retryRef.current();
            spaceTarget = null;
          }
        }
      }
      if (event.type === "click" && retryButton(event.target)) retryRef.current();
      event.stopImmediatePropagation();
    };
    const events = ["focusin", "focusout", "keydown", "keyup", "keypress", "pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "click", "dblclick", "contextmenu"];
    for (const name of events) window.addEventListener(name, isolate, true);
    const keepOpen = (event: Event) => event.preventDefault();
    dialog.addEventListener("cancel", keepOpen);
    dialog.showModal();
    const retry = dialog.querySelector<HTMLButtonElement>("button[data-alpha-session-retry]");
    if (retry && !retry.disabled) retry.focus({ preventScroll: true });
    else dialog.focus({ preventScroll: true });

    return () => {
      dialog.close();
      for (const name of events) window.removeEventListener(name, isolate, true);
      dialog.removeEventListener("cancel", keepOpen);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  // An existing Radix Sheet can aria-hide the application root. Keep recovery
  // outside that ancestor without moving or remounting any existing editor.
  if (typeof document === "undefined") return null;
  return createPortal(<dialog
    ref={dialogRef}
    tabIndex={-1}
    aria-label="Recuperação da conexão"
    aria-modal="true"
    data-alpha-session-recovery="true"
    className="pointer-events-auto fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-4 text-slate-100 backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm"
  ><div className="grid h-full place-items-center">{children}</div></dialog>, document.body);
}
