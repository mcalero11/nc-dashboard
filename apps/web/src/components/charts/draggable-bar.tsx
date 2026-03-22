'use client';

import type { RectangleProps } from 'recharts';

interface DraggableBarProps extends RectangleProps {
  isDragging?: boolean;
  onBarPointerDown?: (e: React.PointerEvent) => void;
  onBarPointerMove?: (e: React.PointerEvent) => void;
  onBarPointerUp?: (e: React.PointerEvent) => void;
}

export function DraggableBar({
  x,
  y,
  width,
  height,
  fill,
  isDragging,
  onBarPointerDown,
  onBarPointerMove,
  onBarPointerUp,
}: DraggableBarProps) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={isDragging ? 'var(--color-chart-2)' : fill}
      rx={4}
      ry={4}
      style={{ cursor: 'ns-resize', touchAction: 'none' }}
      onPointerDown={onBarPointerDown}
      onPointerMove={onBarPointerMove}
      onPointerUp={onBarPointerUp}
    />
  );
}
