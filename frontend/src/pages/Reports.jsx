import { useEffect, useState } from 'react';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Alert, Loading, PageHeader, money } from '../components/ui';

const mLabel = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

/** Dependency-free bar chart. series: [{key,label,cls}] */
function Bars({ data, series, fmt = (v) => v }) {
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key])));
  return (
    <div>
      <div className="flex h-48 items-end gap-2 overflow-x-auto pb-1">
        {data.map((d) => (
          <div key={d.period} className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-1">
            <div className="flex h-40 w-full items-end justify-center gap-0.5" title={series.map((s) => `${s.label}: ${fmt(d[s.key])}`).join(' · ')}>
              {series.map((s) => <div key={s.key} className={`w-full max-w-[1.25rem] rounded-t ${s.cls}`} style={{ height: `${(d[s.key] / max) * 100}%`, minHeight: d[s.key] ? 2 : 0 }} />)}
            </div>
            <span className="text-[11px] text-slate-500">{mLabel(d.period)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-600">{series.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${s.cls}`} />{s.label}</span>)}</div>
    </div>
  );
}

export default function Reports() {
  const { profile } = useAuth();
  const admin = profile.role === 'admin';
  const [months, setMonths] = useState(12);
  const [rev, setRev] = useState(null); const [enr, setEnr] = useState(null); const [courses, setCourses] = useState(null); const [err, setErr] = useState('');

  useEffect(() => {
    let live = true; setErr('');
    const calls = [api.get('/api/reports/enrollment', { params: { months } }), api.get('/api/reports/courses')];
    if (admin) calls.push(api.get('/api/reports/revenue', { params: { months } }));
    Promise.all(calls).then(([e, c, r]) => { if (!live) return; setEnr(e.data.data); setCourses(c.data.data); if (r) setRev(r.data.data); })
      .catch((x) => live && setErr(errorMessage(x)));
    return () => { live = false; };
  }, [months, admin]);

  const totalRev = rev?.reduce((a, r) => a + r.revenue, 0) ?? 0;
  return (
    <section className="space-y-6">
      <PageHeader title="Reports and analytics" subtitle={admin ? 'Revenue, enrollment trends and course performance.' : 'Enrollment trends and course performance.'}>
        <label className="text-sm text-slate-600">Period{' '}
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="rounded-md border-slate-300 text-sm">
            {[6, 12, 24].map((m) => <option key={m} value={m}>Last {m} months</option>)}
          </select></label>
      </PageHeader>
      <Alert>{err}</Alert>
      {!enr && !err && <Loading />}

      {admin && rev && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-baseline justify-between"><h2 className="font-semibold text-slate-900">Monthly revenue</h2><span className="text-sm text-slate-600">Total {money(totalRev)}</span></div>
          <Bars data={rev} series={[{ key: 'revenue', label: 'Collected', cls: 'bg-emerald-600' }]} fmt={money} />
        </div>
      )}
      {enr && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-900">Enrollment trend</h2>
          <Bars data={enr} series={[{ key: 'submitted', label: 'Submitted', cls: 'bg-slate-400' }, { key: 'approved', label: 'Approved', cls: 'bg-emerald-600' }, { key: 'rejected', label: 'Rejected', cls: 'bg-rose-500' }]} />
        </div>
      )}
      {courses && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left font-medium text-slate-600"><tr><th className="px-4 py-3">Course</th><th className="px-4 py-3">Enrolled</th>{admin && <><th className="px-4 py-3">Invoiced</th><th className="px-4 py-3">Collected</th></>}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((c) => <tr key={c.course_id}><td className="px-4 py-3 font-medium text-slate-900">{c.title}</td><td className="px-4 py-3 tabular-nums">{c.enrolled}</td>{admin && <><td className="px-4 py-3 tabular-nums">{money(c.invoiced)}</td><td className="px-4 py-3 tabular-nums">{money(c.collected)}</td></>}</tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
