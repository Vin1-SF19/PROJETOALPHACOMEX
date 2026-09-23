'use client';

import { useState, useSyncExternalStore, useCallback } from 'react';

const STORAGE_KEY = 'alpha-sidebar-collapsed';
const CHANGE_EVENT = 'alpha-sidebar-collapsed-change';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function getServerSnapshot() {
  return false;
}

export function useSidebarState() {
  const isCollapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(!getSnapshot()));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch { /* storage unavailable */ }
  }, []);

  const toggleMobile = useCallback(() => {
    setIsMobileOpen(prev => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  return { isCollapsed, isMobileOpen, toggleCollapse, toggleMobile, closeMobile };
}
