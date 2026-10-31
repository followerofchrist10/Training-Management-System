import { useEffect, useRef } from 'react';

export const money = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: import.meta.env.VITE_CURRENCY || 'INR', maximumFractionDigits: 2 }).format(Number(n ?? 0));
export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

const TONES = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-600/20', under_review: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20', paid: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  rejected: 'bg-rose-50 text-rose-800 ring-rose-600/20', unpaid: 'bg-rose-50 text-rose-800 ring-rose-600/20',
  partial: 'bg-amber-50 text-amber-800 ring-amber-600/20', cancelled: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  void: 'bg-slate-100 text-slate-600 ring-slate-500/20', present: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  absent: 'bg-rose-50 text-rose-800 ring-rose-600/20', late: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  excused: 'bg-sky-50 text-sky-800 ring-sky-600/20', active: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};
export function Badge({ value, label }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${TONES[value] ?? TONES.cancelled}`}>
      {label ?? String(value).replace('_', ' ')}
    </span>
  );
}

export const Btn = ({ tone = 'dark', className = '', ...p }) => {
  const tones = {
    dark: 'bg-slate-900 text-white hover:bg-slate-700',
    green: 'bg-emerald-700 text-white hover:bg-emerald-600',
    red: 'bg-rose-700 text-white hover:bg-rose-600',
    ghost: 'text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
    danger: 'text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50',
  };
  return <button {...p} className={`rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]} ${className}`} />;
};

export const PageHeader = ({ title, subtitle, children }) => (
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 className="text-2xl font-semibold text-slate-900">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}</div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </header>
);

export const Alert = ({ tone = 'error', children, onRetry }) => children ? (
  <p role={tone === 'error' ? 'alert' : 'status'} className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${tone === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
    <span>{children}</span>{onRetry && <button onClick={onRetry} className="font-medium underline">Try again</button>}
  </p>
) : null;

export const Empty = ({ children }) => <p className="py-12 text-center text-sm text-slate-500">{children}</p>;
export const Loading = ({ label = 'Loading…' }) => <p className="py-12 text-center text-sm text-slate-500">{label}</p>;

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector('input,select,textarea,button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div ref={ref} className={`max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white p-5 shadow-xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pager({ page, meta, setPage, loading }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm text-slate-600" aria-label="Pagination">
      <span>Page {page} of {meta.totalPages} ({meta.total} total)</span>
      <div className="flex gap-2">
        <Btn tone="ghost" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</Btn>
        <Btn tone="ghost" disabled={page >= meta.totalPages || loading} onClick={() => setPage(page + 1)}>Next</Btn>
      </div>
    </nav>
  );
}

export const Pills = ({ options, value, onChange, label }) => (
  <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={label}>
    {options.map((o) => (
      <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
        className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${value === o.value ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'}`}>
        {o.label}
      </button>
    ))}
  </div>
);

export const SearchBox = ({ value, onChange, placeholder = 'Search' }) => (
  <div className="w-full sm:w-64">
    <label className="sr-only">{placeholder}</label>
    <input type="search" value={value} maxLength={80} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500" />
  </div>
);

export const Kpi = ({ label, value, hint, tone }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4">
    <p className="text-sm text-slate-500">{label}</p>
    <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'warn' ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p>
    {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
  </div>
);