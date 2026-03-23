'use client';

import { useEffect } from 'react';

interface ShortcutConfig {
  key: string;
  handler: (e: KeyboardEvent) => void;
  ignoreWhenInputFocused?: boolean;
}

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      for (const shortcut of shortcuts) {
        if (e.key !== shortcut.key) continue;
        const ignore = shortcut.ignoreWhenInputFocused ?? true;
        if (ignore && isInputFocused()) continue;
        shortcut.handler(e);
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
