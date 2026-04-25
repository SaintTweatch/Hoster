import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="card w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 flex items-center justify-between border-b border-ink-500/40">
          <h3 className="font-medium text-ink-100">{title}</h3>
          <button onClick={onClose} className="text-ink-200 hover:text-ink-100"><X size={18} /></button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-ink-500/40 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
