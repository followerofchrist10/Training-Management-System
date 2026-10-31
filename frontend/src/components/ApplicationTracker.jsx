import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errorMessage } from '../lib/api';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'under_review', label: 'Under review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const BADGE = {
  pending:      { label: 'Pending',      cls: 'bg-amber-50 text-amber-800 ring-amber-600/20',     dot: 'bg-amber-500' },
  under_review: { label: 'Under review', cls: 'bg-sky-50 text-sky-800 ring-sky-600/20',           dot: 'bg-sky-500' },
  approved:     { label: 'Approved',     cls: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20', dot: 'bg-emerald-500' },
  rejected:     { label: 'Rejected',     cls: 'bg-rose-50 text-rose-800 ring-rose-600/20',        dot: 'bg-rose-500' },
  cancelled:    { label: 'Cancelled',    cls: 'bg-slate-100 text-slate-600 ring-slate-500/20',    dot: 'bg-slate-400' },
};

function StatusBadge({ status }) {
  const b = BADGE[status] ?? BADGE.cancelled;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${b.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${b.dot}`} aria-hidden="true" />
      {b.label}
    </span>
  );
}

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Buttons offered for each state — mirrors the transitions enforced in SQL. */
function RowActions({ app, busy, onStartReview, onApprove, onReject }) {
  const btn = 'rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';
  if (app.status === 'pending') {
    return (
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => onStartReview(app)} className={`${btn} bg-slate-900 text-white hover:bg-slate-700 focus-visible:ring-slate-900`}>Start review</button>
        <button disabled={busy} onClick={() => onReject(app)} className={`${btn} text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50 focus-visible:ring-rose-500`}>Reject</button>
      </div>
    );
  }
  if (app.status === 'under_review') {
    return (
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => onApprove(app)} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-600 focus-visible:ring-emerald-700`}>Approve</button>
        <button disabled={busy} onClick={() => onReject(app)} className={`${btn} text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50 focus-visible:ring-rose-500`}>Reject</button>
      </div>
    );
  }
  return <span className="text-sm text-slate-400">No actions</span>;
}

function RejectDialog({ app, onCancel, onConfirm, busy }) {
  const [reason, setReason] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="reject-title">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 id="reject-title" className="text-lg font-semibold text-slate-900">Reject {app.student.full_name}'s application?</h2>
        <p className="mt-1 text-sm text-slate-600">{app.batch.course.title}, {app.batch.name}. The student will see your reason.</p>
        <label htmlFor="reason" className="mt-4 block text-sm font-medium text-slate-700">Reason</label>
        <textarea id="reason" ref={ref} rows={4} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500" />
        <div className="mt-1 text-right text-xs text-slate-400">{reason.length}/1000</div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50">Keep application</button>
          <button disabled={busy || !reason.trim()} onClick={() => onConfirm(reason.trim())}
            className="rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? 'Rejecting…' : 'Reject application'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApplicationTracker() {
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const load = useCallback(async (signal) => {
    setLoading(true); setError('');
    try {
      const [list, summary] = await Promise.all([
        api.get('/api/applications', {
          signal,
          params: { status: filter || undefined, search: debouncedSearch || undefined, page, pageSize },
        }),
        api.get('/api/applications/summary', { signal }),
      ]);
      setRows(list.data.data); setMeta(list.data.meta); setCounts(summary.data.data);
    } catch (e) {
      if (e.code !== 'ERR_CANCELED') setError(errorMessage(e));
    } finally { setLoading(false); }
  }, [filter, debouncedSearch, page]);

  useEffect(() => {
    const ctl = new AbortController();
    load(ctl.signal);
    return () => ctl.abort();
  }, [load]);

  useEffect(() => { setPage(1); }, [filter, debouncedSearch]);

  const transition = async (app, status, notes) => {
    setBusyId(app.id); setNotice(''); setError('');
    try {
      await api.patch(`/api/applications/${app.id}/status`, { status, notes });
      setNotice(`${app.student.full_name}: ${BADGE[status].label.toLowerCase()}.`);
      setRejecting(null);
      await load();
    } catch (e) {
      setError(errorMessage(e));
      await load();                 // state may have changed under us (another staff member acted)
    } finally { setBusyId(null); }
  };

  const actions = {
    onStartReview: (a) => transition(a, 'under_review'),
    onApprove: (a) => transition(a, 'approved'),
    onReject: (a) => setRejecting(a),
  };

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Applications</h1>
          <p className="mt-1 text-sm text-slate-600">
            {counts.pending ?? 0} waiting for a decision, {counts.under_review ?? 0} in review.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <label htmlFor="search" className="sr-only">Search by student name</label>
          <input id="search" type="search" value={search} maxLength={80} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name"
            className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500" />
        </div>
      </header>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const n = f.key ? counts[f.key] : totalAll;
          return (
            <button key={f.key || 'all'} role="tab" aria-selected={active} onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
                active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'}`}>
              {f.label}
              {n !== undefined && <span className={`ml-1.5 tabular-nums ${active ? 'text-slate-300' : 'text-slate-400'}`}>{n}</span>}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="mt-4 space-y-2">
        {notice && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
        {error && (
          <p className="flex items-center justify-between gap-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            <span>{error}</span>
            <button onClick={() => load()} className="font-medium underline">Try again</button>
          </p>
        )}
      </div>

      {/* Desktop / tablet: table */}
      <div className="mt-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left font-medium text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3">Student</th>
              <th scope="col" className="px-4 py-3">Course and batch</th>
              <th scope="col" className="px-4 py-3">Submitted</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((a) => (
              <tr key={a.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{a.student.full_name}</div>
                  <div className="text-slate-500">{a.student.email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-900">{a.batch.course.title}</div>
                  <div className="text-slate-500">{a.batch.name}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(a.submitted_at)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={a.status} />
                  {a.review_notes && <p className="mt-1 max-w-[16rem] text-xs text-slate-500">{a.review_notes}</p>}
                </td>
                <td className="px-4 py-3"><RowActions app={a} busy={busyId === a.id} {...actions} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="mt-4 space-y-3 md:hidden">
        {rows.map((a) => (
          <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{a.student.full_name}</p>
                <p className="truncate text-sm text-slate-500">{a.student.email}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <p className="mt-3 text-sm text-slate-900">{a.batch.course.title}</p>
            <p className="text-sm text-slate-500">{a.batch.name}, submitted {fmtDate(a.submitted_at)}</p>
            {a.review_notes && <p className="mt-2 text-xs text-slate-500">{a.review_notes}</p>}
            <div className="mt-3"><RowActions app={a} busy={busyId === a.id} {...actions} /></div>
          </li>
        ))}
      </ul>

      {loading && rows.length === 0 && <p className="py-12 text-center text-sm text-slate-500">Loading applications…</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-500">
          {debouncedSearch || filter ? 'No applications match these filters. Clear the search or pick All.' : 'No applications yet. New student requests will appear here.'}
        </p>
      )}

      {meta.totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm text-slate-600" aria-label="Pagination">
          <span>Page {page} of {meta.totalPages} ({meta.total} total)</span>
          <div className="flex gap-2">
            <button disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}
              className="rounded-md px-3 py-1.5 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50">Previous</button>
            <button disabled={page >= meta.totalPages || loading} onClick={() => setPage((p) => p + 1)}
              className="rounded-md px-3 py-1.5 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50">Next</button>
          </div>
        </nav>
      )}

      {rejecting && (
        <RejectDialog app={rejecting} busy={busyId === rejecting.id}
          onCancel={() => setRejecting(null)} onConfirm={(reason) => transition(rejecting, 'rejected', reason)} />
      )}
    </section>
  );
}