'use client';

import { useRef } from 'react';

export default function ColumnResizeHandle({ label, width, onChange }: { label: string; width: number; onChange: (width: number) => void }) {
  const drag = useRef<{ left: number; width: number } | null>(null);
  return <span className="column-resize-handle" role="separator" aria-orientation="vertical" tabIndex={0}
    aria-label={`Resize ${label} column`} aria-valuemin={88} aria-valuemax={800} aria-valuenow={Math.round(width)}
    title={`Resize ${label} column`}
    onClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      drag.current = { left: event.clientX, width: event.currentTarget.closest('th')?.getBoundingClientRect().width || width };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => { if (drag.current) onChange(drag.current.width + event.clientX - drag.current.left); }}
    onPointerUp={(event) => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
    onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={(event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      onChange(event.key === 'Home' ? 88 : event.key === 'End' ? 800 : width + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 64 : 16));
    }} />;
}