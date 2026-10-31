import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../lib/api';
import { Alert, Badge, Btn, Empty, Loading, Modal, PageHeader, fmtDate, money } from '../components/ui';

const LIVE = ['pending', 'under_review', 'approved'];

export default function Apply() {
  const [batches, setBatches] = useState(null); const [mine, setMine] = useState(null);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [target, setTarget] = useState(null); const [motivation, setMotivation] = useState('');
  const [busy, setBusy] = useState(false); const [formErr, setFormErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [b, m] = await Promise.all([api.get('/api/open-batches'), api.get('/api/applications', { params: { pageSize: 100 } })]);
      setBatches(b.data.data); setMine(m.data.data); setErr('');
    } catch (e) { setErr(errorMessage(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const applied = new Set((mine ?? []).filter((a) => LIVE.includes(a.status)).map((a) => a.batch_id));

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setFormErr('');
    try {
      await api.post('/api/applications', { batchId: target.id, motivation: motivation.trim() || undefined });
      setOk(`Application submitted for ${target.course_title}. It is now pending review.`);
      setTarget(null); setMotivation(''); load();
    } catch (x) { setFormErr(errorMessage(x)); } finally { setBusy(false); }
  };
  const cancel = async (a) => {
    if (!window.confirm('Cancel this application?')) return;
    try { await api.post(`/api/applications/${a.id}/cancel`); setOk('Application cancelled.'); load(); } catch (x) { setErr(errorMessage(x)); }
  };

  return (
    <section className="space-y-8">
      <PageHeader title="Apply and track" subtitle="Pick a batch, apply, and follow the decision here." />
      <div className="space-y-2" aria-live="polite"><Alert tone="ok">{ok}</Alert><Alert onRetry={load}>{err}</Alert></div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Open batches</h2>
        {!batches ? <Loading /> : batches.length === 0 ? <Empty>No batches are open for applications right now.</Empty> : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {batches.map((b) => (
              <li key={b.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
                <p className="font-medium text-slate-900">{b.course_title}</p>
                <p className="text-sm text-slate-500">{b.name} · {b.course_code}</p>
                <p className="mt-2 text-sm text-slate-700">Starts {fmtDate(b.starts_on)}, ends {fmtDate(b.ends_on)}</p>
                <p className="text-sm text-slate-700">{money(b.price)} · {b.seats_left} of {b.capacity} seats left</p>
                <div className="mt-auto pt-3">
                  {applied.has(b.id) ? <Badge value="pending" label="Already applied" /> :
                    <Btn disabled={b.seats_left === 0} onClick={() => { setTarget(b); setFormErr(''); }}>{b.seats_left === 0 ? 'Full' : 'Apply'}</Btn>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">My applications</h2>
        {!mine ? <Loading /> : mine.length === 0 ? <Empty>You haven't applied yet.</Empty> : (
          <ul className="mt-3 space-y-3">
            {mine.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{a.batch.course.title}</p>
                    <p className="text-sm text-slate-500">{a.batch.name} · applied {fmtDate(a.submitted_at)}</p>
                  </div>
                  <Badge value={a.status} />
                </div>
                {a.review_notes && <p className="mt-2 text-sm text-slate-600">Reviewer note: {a.review_notes}</p>}
                {['pending', 'under_review'].includes(a.status) && <Btn tone="danger" className="mt-3" onClick={() => cancel(a)}>Cancel application</Btn>}
                {a.status === 'approved' && <p className="mt-2 text-sm text-emerald-700">Approved. Your invoice is under Fees and receipts.</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {target && (
        <Modal title={`Apply: ${target.course_title}`} onClose={() => setTarget(null)}>
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-slate-600">{target.name}, starts {fmtDate(target.starts_on)}.</p>
            <label className="block text-sm font-medium text-slate-700">Why do you want to join? (optional)
              <textarea rows={4} maxLength={2000} value={motivation} onChange={(e) => setMotivation(e.target.value)} className="mt-1 w-full rounded-md border-slate-300 text-sm" /></label>
            <Alert>{formErr}</Alert>
            <div className="flex justify-end gap-2"><Btn type="button" tone="ghost" onClick={() => setTarget(null)}>Cancel</Btn><Btn type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</Btn></div>
          </form>
        </Modal>
      )}
    </section>
  );
}