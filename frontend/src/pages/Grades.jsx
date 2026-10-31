import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Alert, Btn, Empty, Loading, PageHeader, fmtDate } from '../components/ui';

const pct = (g) => Math.round((Number(g.score) / Number(g.max_score)) * 100);

export default function Grades() {
  const { profile } = useAuth();
  return profile.role === 'instructor' ? <Entry /> : <MyGrades />;
}

function Entry() {
  const [batches, setBatches] = useState([]); const [batchId, setBatchId] = useState('');
  const [roster, setRoster] = useState([]); const [grades, setGrades] = useState([]);
  const [assessment, setAssessment] = useState(''); const [max, setMax] = useState('100'); const [scores, setScores] = useState({});
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [loading, setLoading] = useState(false);

  useEffect(() => { api.get('/api/batches', { params: { pageSize: 100 } }).then((r) => setBatches(r.data.data)).catch((e) => setErr(errorMessage(e))); }, []);
  const load = useCallback(async () => {
    if (!batchId) { setRoster([]); setGrades([]); return; }
    setLoading(true);
    try {
      const [r, g] = await Promise.all([api.get(`/api/roster/${batchId}`), api.get('/api/grades', { params: { batch_id: batchId, pageSize: 100 } })]);
      setRoster(r.data.data); setGrades(g.data.data); setErr('');
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, [batchId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setOk(''); setErr('');
    if (!assessment.trim()) return setErr('Name the assessment first.');
    const entries = roster.filter((s) => scores[s.student_id] !== undefined && scores[s.student_id] !== '');
    if (!entries.length) return setErr('Enter at least one score.');
    const results = await Promise.allSettled(entries.map((s) => api.post('/api/grades', {
      batch_id: batchId, student_id: s.student_id, assessment: assessment.trim(), score: Number(scores[s.student_id]), max_score: Number(max),
    })));
    const failed = results.map((r, i) => (r.status === 'rejected' ? `${entries[i].full_name}: ${errorMessage(r.reason)}` : null)).filter(Boolean);
    if (failed.length) setErr(failed.join(' | '));
    const saved = results.length - failed.length;
    if (saved) { setOk(`Saved ${saved} score${saved > 1 ? 's' : ''}.`); setScores({}); load(); }
  };
  const del = async (g) => {
    if (!window.confirm('Delete this grade?')) return;
    try { await api.delete(`/api/grades/${g.id}`); load(); } catch (e) { setErr(errorMessage(e)); }
  };

  return (
    <section>
      <PageHeader title="Grades" subtitle="Enter assessment scores for your batches." />
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600"><span className="mb-1 block">Batch</span>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-md border-slate-300 text-sm">
            <option value="">Select a batch</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.course?.title})</option>)}
          </select></label>
      </div>
      <div className="mt-4 space-y-2" aria-live="polite"><Alert tone="ok">{ok}</Alert><Alert>{err}</Alert></div>

      {loading ? <Loading /> : batchId && (
        <>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">New assessment</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="text-sm text-slate-600"><span className="mb-1 block">Assessment name</span>
                <input value={assessment} maxLength={80} onChange={(e) => setAssessment(e.target.value)} placeholder="e.g. Midterm quiz" className="rounded-md border-slate-300 text-sm" /></label>
              <label className="text-sm text-slate-600"><span className="mb-1 block">Maximum score</span>
                <input type="number" min="1" value={max} onChange={(e) => setMax(e.target.value)} className="w-28 rounded-md border-slate-300 text-sm" /></label>
            </div>
            {roster.length === 0 ? <Empty>No approved students in this batch yet.</Empty> : (
              <ul className="mt-3 divide-y divide-slate-100">
                {roster.map((s) => (
                  <li key={s.student_id} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm text-slate-800">{s.full_name}</span>
                    <input type="number" min="0" max={max} step="0.01" aria-label={`Score for ${s.full_name}`} value={scores[s.student_id] ?? ''}
                      onChange={(e) => setScores((x) => ({ ...x, [s.student_id]: e.target.value }))} className="w-28 rounded-md border-slate-300 text-sm" />
                  </li>
                ))}
              </ul>
            )}
            {roster.length > 0 && <div className="mt-3 flex justify-end"><Btn onClick={save}>Save scores</Btn></div>}
          </div>

          <h2 className="mt-6 text-sm font-semibold text-slate-900">Recorded grades</h2>
          {grades.length === 0 ? <Empty>No grades recorded for this batch.</Empty> : (
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left font-medium text-slate-600"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Assessment</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Date</th><th className="px-4 py-3"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {grades.map((g) => (
                    <tr key={g.id}><td className="px-4 py-3">{g.student?.full_name}</td><td className="px-4 py-3">{g.assessment}</td>
                      <td className="px-4 py-3 tabular-nums">{g.score}/{g.max_score} ({pct(g)}%)</td><td className="px-4 py-3">{fmtDate(g.graded_at)}</td>
                      <td className="px-4 py-3"><Btn tone="danger" onClick={() => del(g)}>Delete</Btn></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function MyGrades() {
  const [rows, setRows] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api.get('/api/grades', { params: { pageSize: 100 } }).then((r) => setRows(r.data.data)).catch((e) => setErr(errorMessage(e))); }, []);
  const avg = rows?.length ? Math.round(rows.reduce((a, g) => a + (Number(g.score) / Number(g.max_score)) * 100, 0) / rows.length) : null;
  return (
    <section>
      <PageHeader title="My grades" subtitle={avg != null ? `Overall average ${avg}%` : 'Your assessment scorecard.'} />
      <div className="mt-4"><Alert>{err}</Alert></div>
      {!rows && !err ? <Loading /> : rows?.length === 0 ? <Empty>No grades yet.</Empty> : rows && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left font-medium text-slate-600"><tr><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Assessment</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Date</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((g) => (
                <tr key={g.id}><td className="px-4 py-3">{g.batch?.name}</td><td className="px-4 py-3">{g.assessment}</td>
                  <td className="px-4 py-3 tabular-nums">{g.score}/{g.max_score} ({pct(g)}%)</td><td className="px-4 py-3">{fmtDate(g.graded_at)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}