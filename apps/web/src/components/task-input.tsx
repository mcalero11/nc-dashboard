'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { useRecentTasks } from '@/hooks/use-recent-tasks';
import { cn } from '@/lib/utils';

interface TaskInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  project?: string;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

export function TaskInput({
  value,
  onChange,
  placeholder = 'Task',
  className,
  onKeyDown,
  project,
}: TaskInputProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { data } = useRecentTasks(project);

  const tasks = data?.tasks ?? [];
  const filtered = tasks.filter((t) =>
    t.toLowerCase().includes(value.toLowerCase()),
  );

  const showDropdown = open && filtered.length > 0;

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownMaxHeight = 200; // max-h-48 ≈ 192px
    if (spaceBelow < dropdownMaxHeight) {
      setPosition({
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showDropdown, updatePosition]);

  const select = useCallback(
    (task: string) => {
      onChange(task);
      setOpen(false);
      setHighlightedIndex(-1);
    },
    [onChange],
  );

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
        return;
      }
      if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        select(filtered[highlightedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setHighlightedIndex(-1);
        return;
      }
    }
    onKeyDown?.(e);
  }

  function handleBlur(e: React.FocusEvent) {
    // Don't close if clicking within the dropdown
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    setOpen(false);
    setHighlightedIndex(-1);
  }

  const dropdown =
    showDropdown && position
      ? createPortal(
          <ul
            ref={listRef}
            className={cn(
              'fixed z-50 max-h-48 overflow-auto rounded-md border bg-popover p-1 shadow-md',
            )}
            style={{
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {filtered.map((task, i) => (
              <li
                key={task}
                role="option"
                aria-selected={i === highlightedIndex}
                className={cn(
                  'cursor-pointer rounded-sm px-2 py-1.5 text-sm',
                  i === highlightedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50',
                )}
                onMouseEnter={() => setHighlightedIndex(i)}
                onClick={() => select(task)}
              >
                {task}
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {dropdown}
    </div>
  );
}
