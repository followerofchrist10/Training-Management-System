import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../lib/api';
import { useRealtime } from '../lib/realtime';
import { Alert, Btn, Empty, Loading, PageHeader, Pager, fmtDateTime } from '../components/ui';

export default function Notifications() {
  const [rows, setRows] = useState(null); const [meta, setMeta] = useState(null); const [page, setPage] = useState(1); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try { const r = await api.get('/api/notifications', { params: { page, pageSize: 20 } }); setRows(r.data.data); setMeta(r.data.meta); setErr(''); }
    catch (e) { setErr(errorMessage(e)); }
  }, [page]);
  useEffect(() => { load(); }, [load]);
  useRealtime('notifications', load);

  const markAll = async () => { try { await api.post('/api/notifications/read-all'); load(); } catch (e) { setErr(errorMessage(e)); } };
  const markOne = async (n) => { if (n.is_read) return; try { await api.patch(`/api/notifications/${n.id}/read`); load(); } catch (e) { setErr(errorMessage(e)); } };

  return (
    <section>
      <PageHeader title="Notifications" subtitle="Confirmations and status updates.">
        {meta?.unread > 0 && <Btn tone="ghost" onClick={markAll}>Mark all as read ({meta.unread})</Btn>}
      </PageHeader>
      <div className="mt-4"><Alert onRetry={load}>{err}</Alert></div>
      {!rows && !err ? <Loading /> : rows?.length === 0 ? <Empty>No notifications yet.</Empty> : rows && (
        <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {rows.map((n) => (
            <li key={n.id}>
              <button onClick={() => markOne(n)} className={`flex w-full items-start gap-3 px-4 py-3 text-left ${n.is_read ? '' : 'bg-sky-50/60'}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-sky-500'}`} aria-label={n.is_read ? 'Read' : 'Unread'} />
                <span><span className="block text-sm font-medium text-slate-900">{n.title}</span>
                  {n.body && <span className="block text-sm text-slate-600">{n.body}</span>}
                  <span className="block text-xs text-slate-400">{fmtDateTime(n.created_at)}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} meta={meta} setPage={setPage} />
    </section>
  );
}