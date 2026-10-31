import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useRealtime } from '../lib/realtime';
import { Alert, Kpi, Loading, PageHeader, fmtDateTime, money } from '../components/ui';

const CARDS = {
  admin: (d) => [['Pending applications', d.pending, 'Waiting for a decision', d.pending > 0 && 'warn'], ['Under review', d.under_review], ['Approved (30 days)', d.approved_30d], ['Active batches', d.active_batches], ['Students', d.students], ['Outstanding fees', money(d.outstanding)], ['Revenue (30 days)', money(d.revenue_30d)]],
  staff: (d) => [['Pending applications', d.pending, 'Waiting for a decision', d.pending > 0 && 'warn'], ['Under review', d.under_review], ['Approved (30 days)', d.approved_30d], ['Active batches', d.active_batches], ['Students', d.students], ['Outstanding fees', money(d.outstanding)]],
  instructor: (d) => [['Active batches', d.my_batches], ['Students taught', d.my_students], ['Attendance marked today', d.marked_today]],
  student: (d) => [['Applications in progress', d.open_applications], ['Enrolled batches', d.enrolled], ['Balance due', money(d.balance_due), null, d.balance_due > 0 && 'warn'], ['Average grade', d.avg_grade_pct == null ? '—' : `${d.avg_grade_pct}%`]],
};
const QUICK = {
  admin: [['/applications', 'Review applications'], ['/reports', 'View reports'], ['/users', 'Manage roles']],
  staff: [['/applications', 'Review applications'], ['/batches', 'Manage batches'], ['/invoices', 'Record payments']],
  instructor: [['/attendance', 'Mark attendance'], ['/grades', 'Enter grades']],
  student: [['/apply', 'Apply for a batch'], ['/invoices', 'View fees'], ['/grades', 'View grades']],
};

export default function Dashboard() {
  const { profile } = useAuth();
  const [d, setD] = useState(null); const [feed, setFeed] = useState([]); const [err, setErr] = useState('');
  const staff = ['staff', 'admin'].includes(profile.role);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.get('/api/dashboard'), api.get('/api/dashboard/activity')]);
      setD(a.data.data); setFeed(b.data.data); setErr('');
    } catch (e) { setErr(errorMessage(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtime(staff ? 'application_status_history' : 'notifications', load);   // live activity feed

  return (
    <section>
      <PageHeader title={`Welcome, ${profile.full_name.split(' ')[0]}`} subtitle="Here is where things stand." />
      <div className="mt-4"><Alert onRetry={load}>{err}</Alert></div>
      {!d && !err && <Loading />}
      {d && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CARDS[profile.role](d).map(([label, value, hint, tone]) => <Kpi key={label} label={label} value={value} hint={hint} tone={tone} />)}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
              <h2 className="text-sm font-semibold text-slate-900">{staff ? 'Recent application activity' : 'Recent updates'} <span className="ml-1 text-xs font-normal text-emerald-700">live</span></h2>
              {feed.length === 0 ? <p className="py-6 text-sm text-slate-500">Nothing yet.</p> : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {feed.map((f) => (
                    <li key={f.id} className="py-2.5 text-sm">
                      <p className="text-slate-800">{f.text}</p>
                      {f.sub && <p className="text-slate-500">{f.sub}</p>}
                      <p className="text-xs text-slate-400">{fmtDateTime(f.at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
              <ul className="mt-3 space-y-2">
                {QUICK[profile.role].map(([to, label]) => (
                  <li key={to}><Link to={to} className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">{label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}