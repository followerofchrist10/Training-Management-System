import { useEffect, useState } from 'react';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Alert, Btn, Loading, PageHeader } from '../components/ui';

const FIELDS = [
  ['full_name', 'Full name', 'text', true], ['phone', 'Phone', 'tel'], ['date_of_birth', 'Date of birth', 'date'],
  ['address', 'Address', 'textarea'], ['guardian_name', 'Guardian name'], ['guardian_phone', 'Guardian phone', 'tel'],
  ['learning_pathway', 'Learning pathway (what you want to achieve)'],
];

export default function MyProfile() {
  const { refreshProfile } = useAuth();
  const [v, setV] = useState(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/students/me').then((r) => {
      const d = Array.isArray(r.data.data.details) ? r.data.data.details[0] : r.data.data.details;
      setV(Object.fromEntries(FIELDS.map(([k]) => [k, r.data.data[k] ?? d?.[k] ?? ''])));
    }).catch((e) => setErr(errorMessage(e)));
  }, []);

  const save = async (e) => {
    e.preventDefault(); setErr(''); setOk(''); setBusy(true);
    if (!v.full_name.trim()) { setBusy(false); return setErr('Full name is required.'); }
    const payload = Object.fromEntries(FIELDS.map(([k]) => [k, typeof v[k] === 'string' && v[k].trim() === '' ? null : (typeof v[k] === 'string' ? v[k].trim() : v[k])]));
    payload.full_name = v.full_name.trim();
    try { await api.put('/api/students/me', payload); await refreshProfile(); setOk('Profile saved.'); } catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
  };

  if (!v && !err) return <Loading />;
  const cls = 'mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500';
  return (
    <section className="max-w-xl">
      <PageHeader title="My profile" subtitle="Keep your contact details and learning goals up to date." />
      <form onSubmit={save} className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        {v && FIELDS.map(([k, label, type = 'text', req]) => (
          <label key={k} className="block text-sm font-medium text-slate-700">{label}{req && <span className="text-rose-600"> *</span>}
            {type === 'textarea' ? <textarea rows={3} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className={cls} />
              : <input type={type} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className={cls} />}
          </label>
        ))}
        <Alert>{err}</Alert><Alert tone="ok">{ok}</Alert>
        <Btn type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Btn>
      </form>
    </section>
  );
}