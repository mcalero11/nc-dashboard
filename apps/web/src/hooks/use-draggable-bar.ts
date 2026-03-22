'use client';

import { useRef, useCallback, useState } from 'react';

interface UseDraggableBarOptions {
  minHours: number;
  maxHours: number;
  step: number;
  pixelsPerHour: number;
  onDragEnd: (newHours: number) => void;
}

export function useDraggableBar({
  minHours,
  maxHours,
  step,
  pixelsPerHour,
  onDragEnd,
}: UseDraggableBarOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragHours, setDragHours] = useState<number | null>(null);
  const startY = useRef(0);
  const startHours = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, currentHours: number) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      startY.current = e.clientY;
      startHours.current = currentHours;
      setIsDragging(true);
      setDragHours(currentHours);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const deltaY = startY.current - e.clientY;
      const deltaHours = deltaY / pixelsPerHour;
      const raw = startHours.current + deltaHours;
      const snapped = Math.round(raw / step) * step;
      const clamped = Math.max(minHours, Math.min(maxHours, snapped));
      setDragHours(Math.round(clamped * 100) / 100);
    },
    [isDragging, pixelsPerHour, step, minHours, maxHours],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging || dragHours === null) return;
    setIsDragging(false);
    onDragEnd(dragHours);
    setDragHours(null);
  }, [isDragging, dragHours, onDragEnd]);

  return {
    isDragging,
    dragHours,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
