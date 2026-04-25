import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};
const COLORS = {
  success: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  info: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
  warning: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  error: 'text-red-300 border-red-500/40 bg-red-500/10',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    const t = { id, type: 'info', timeout: 4500, ...toast };
    setToasts((s) => [...s, t]);
    if (t.timeout > 0) {
      setTimeout(() => remove(id), t.timeout);
    }
  }, [remove]);

  const helpers = {
    push,
    success: (message, opts = {}) => push({ ...opts, type: 'success', message }),
    info: (message, opts = {}) => push({ ...opts, type: 'info', message }),
    warning: (message, opts = {}) => push({ ...opts, type: 'warning', message }),
    error: (message, opts = {}) => push({ ...opts, type: 'error', message, timeout: 7000 }),
  };

  return (
    <ToastContext.Provider value={helpers}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={`flex gap-3 items-start p-3 rounded-md border ${COLORS[t.type]} shadow-lg`}>
              <Icon size={18} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-sm">{t.message}</div>
              <button
                className="text-ink-200 hover:text-white"
                onClick={() => remove(t.id)}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
