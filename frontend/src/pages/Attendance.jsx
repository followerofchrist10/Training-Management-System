import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Alert, Badge, Btn, Empty, Loading, PageHeader, fmtDate } from '../components/ui';

const STATUSES = ['present', 'absent', 'late', 'excused'];
const today = () => new Date().toISOString().slice(0, 10);

export default function Attendance() {
  const { profile } = useAuth();
  return profile.role === 'instructor' ? <Marking /> : <MyAttendance />;
}

function Marking() {
  const [batches, setBatches] = useState([]); const [batchId, setBatchId] = useState(''); const [date, setDate] = useState(today());
  const [roster, setRoster] = useState([]); const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState('');

  useEffect(() => { api.get('/api/batches', { params: { pageSize: 100 } }).then((r) => setBatches(r.data.data)).catch((e) => setErr(errorMessage(e))); }, []);

  const load = useCallback(async () => {
    if (!batchId) return setRoster([]);
    setLoading(true); setOk('');
    try {
      const [r, a] = await Promise.all([api.get(`/api/roster/${batchId}`), api.get('/api/attendance', { params: { batchId, date } })]);
      setRoster(r.data.data);
      setMarks(Object.fromEntries(a.data.data.map((x) => [x.student_id, x.status])));
      setErr('');
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, [batchId, date]);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => STATUSES.map((s) => [s, Object.values(marks).filter((m) => m === s).length]), [marks]);
  const save = async () => {
    const records = roster.filter((s) => marks[s.student_id]).map((s) => ({ studentId: s.student_id, status: marks[s.student_id] }));
    if (!records.length) return setErr('Mark at least one student.');
    try { const r = await api.put('/api/attendance', { batchId, date, records }); setOk(`Saved ${r.data.saved} records for ${fmtDate(date)}.`); setErr(''); }
    catch (e) { setErr(errorMessage(e)); }
  };

  return (
    <section>
      <PageHeader title="Attendance" subtitle="Daily attendance for your batches." />
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600"><span className="mb-1 block">Batch</span>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-md border-slate-300 text-sm">
            <option value="">Select a batch</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.course?.title})</option>)}
          </select></label>
        <label className="text-sm text-slate-600"><span className="mb-1 block">Date</span>
          <input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border-slate-300 text-sm" /></label>
        {roster.length > 0 && <Btn tone="ghost" onClick={() => setMarks(Object.fromEntries(roster.map((s) => [s.student_id, 'present'])))}>Mark all present</Btn>}
      </div>
      <div className="mt-4 space-y-2" aria-live="polite"><Alert tone="ok">{ok}</Alert><Alert onRetry={load}>{err}</Alert></div>

      {loading ? <Loading /> : batchId && roster.length === 0 ? <Empty>No approved students in this batch yet.</Empty> : roster.length > 0 && (
        <>
          <p className="mt-4 text-sm text-slate-600">{counts.map(([s, n]) => `${n} ${s}`).join(' · ')}</p>
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {roster.map((s) => (
              <li key={s.student_id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-medium text-slate-900">{s.full_name}</p><p className="text-sm text-slate-500">{s.email}</p></div>
                <div className="flex gap-1.5" role="radiogroup" aria-label={`Attendance for ${s.full_name}`}>
                  {STATUSES.map((st) => (
                    <button key={st} role="radio" aria-checked={marks[s.student_id] === st} onClick={() => setMarks((m) => ({ ...m, [s.student_id]: st }))}
                      className={`rounded-md px-2.5 py-1 text-sm capitalize ring-1 ring-inset ${marks[s.student_id] === st ? 'bg-slate-900 text-white ring-slate-900' : 'text-slate-700 ring-slate-300 hover:bg-slate-50'}`}>{st}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end"><Btn onClick={save}>Save attendance</Btn></div>
        </>
      )}
    </section>
  );
}

function MyAttendance() {
  const [rows, setRows] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api.get('/api/attendance').then((r) => setRows(r.data.data)).catch((e) => setErr(errorMessage(e))); }, []);
  const byBatch = useMemo(() => {
    const m = {};
    (rows ?? []).forEach((r) => { (m[r.batch_id] ??= { name: r.batch?.name, list: [] }).list.push(r); });
    return Object.values(m);
  }, [rows]);

  return (
    <section>
      <PageHeader title="My attendance" subtitle="Present and late both count as attended." />
      <div className="mt-4"><Alert>{err}</Alert></div>
      {!rows && !err ? <Loading /> : byBatch.length === 0 ? <Empty>No attendance recorded yet.</Empty> : (
        <div className="mt-4 space-y-4">
          {byBatch.map((b) => {
            const attended = b.list.filter((r) => ['present', 'late'].includes(r.status)).length;
            return (
              <div key={b.name} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-baseline justify-between"><h2 className="font-medium text-slate-900">{b.name}</h2>
                  <span className="text-sm text-slate-600">{Math.round((attended / b.list.length) * 100)}% ({attended}/{b.list.length} days)</span></div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {b.list.slice(0, 30).map((r) => <li key={r.id} className="text-xs text-slate-500">{fmtDate(r.on_date)} <Badge value={r.status} /></li>)}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}