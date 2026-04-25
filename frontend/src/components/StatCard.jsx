import React from 'react';

const ACCENTS = {
  brand: 'bg-brand-600/20 text-brand-300',
  amber: 'bg-amber-500/15 text-amber-300',
  red: 'bg-red-500/15 text-red-300',
  sky: 'bg-sky-500/15 text-sky-300',
};

export default function StatCard({ icon: Icon, label, value, hint, accent = 'brand' }) {
  const accentClass = ACCENTS[accent] || ACCENTS.brand;
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-md flex items-center justify-center ${accentClass}`}>
        {Icon && <Icon size={20} />}
      </div>
      <div>
        <div className="text-xs text-ink-200">{label}</div>
        <div className="text-lg font-semibold text-ink-100">{value}</div>
        {hint && <div className="text-xs text-ink-200">{hint}</div>}
      </div>
    </div>
  );
}
