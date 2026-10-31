import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDebounced } from '../lib/hooks';
import { Alert, Badge, Btn, Empty, Loading, Modal, PageHeader, Pager, Pills, SearchBox, fmtDate, fmtDateTime, money } from '../components/ui';

const STATUS = [{ value: '', label: 'All' }, { value: 'unpaid', label: 'Unpaid' }, { value: 'partial', label: 'Partly paid' }, { value: 'paid', label: 'Paid' }];

export default function Invoices() {
  const { profile } = useAuth();
  const staff = ['staff', 'admin'].includes(profile.role);
  const [rows, setRows] = useState([]); const [meta, setMeta] = useState(null); const [page, setPage] = useState(1);
  const [status, setStatus] = useState(''); const [search, setSearch] = useState(''); const dSearch = useDebounced(search);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [paying, setPaying] = useState(null); const [receipts, setReceipts] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/invoices', { params: { page, pageSize: 15, status: status || undefined, search: dSearch || undefined } });
      setRows(r.data.data); setMeta(r.data.meta); setErr('');
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, [page, status, dSearch]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => setPage(1), [status, dSearch]);

  const openReceipts = async (inv) => {
    setReceipts({ inv, list: null });
    try { const r = await api.get(`/api/invoices/${inv.id}/payments`); setReceipts({ inv, list: r.data.data }); }
    catch (e) { setReceipts(null); setErr(errorMessage(e)); }
  };

  return (
    <section>
      <PageHeader title={staff ? 'Invoices and payments' : 'Fees and receipts'} subtitle="Invoices are created automatically when an application is approved.">
        {staff && <SearchBox value={search} onChange={setSearch} placeholder="Search by student" />}
      </PageHeader>
      <div className="mt-4"><Pills options={STATUS} value={status} onChange={setStatus} label="Filter by payment status" /></div>
      <div className="mt-4 space-y-2" aria-live="polite"><Alert tone="ok">{ok}</Alert><Alert onRetry={load}>{err}</Alert></div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left font-medium text-slate-600">
            <tr><th className="px-4 py-3">Invoice</th>{staff && <th className="px-4 py-3">Student</th>}<th className="px-4 py-3">Course</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Balance</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((i) => {
              const bal = Number(i.amount) - Number(i.amount_paid);
              return (
                <tr key={i.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{i.invoice_no}</td>
                  {staff && <td className="px-4 py-3"><div>{i.student?.full_name}</div><div className="text-slate-500">{i.student?.email}</div></td>}
                  <td className="px-4 py-3">{i.application?.batch?.course?.title}<div className="text-slate-500">{i.application?.batch?.name}</div></td>
                  <td className="px-4 py-3 tabular-nums">{money(i.amount)}</td>
                  <td className="px-4 py-3 tabular-nums">{money(i.amount_paid)}</td>
                  <td className="px-4 py-3 tabular-nums">{money(bal)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{fmtDate(i.due_on)}</td>
                  <td className="px-4 py-3"><Badge value={i.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex gap-2">
                      {staff && bal > 0 && i.status !== 'void' && <Btn tone="green" onClick={() => setPaying(i)}>Record payment</Btn>}
                      <Btn tone="ghost" onClick={() => openReceipts(i)}>Receipts</Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && rows.length === 0 && <Loading />}
        {!loading && !err && rows.length === 0 && <Empty>No invoices match.</Empty>}
      </div>
      <Pager page={page} meta={meta} setPage={setPage} loading={loading} />

      {paying && <PaymentModal inv={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); setOk('Payment recorded and receipt issued.'); load(); }} />}
      {receipts && (
        <Modal title={`Receipts: ${receipts.inv.invoice_no}`} onClose={() => setReceipts(null)}>
          {!receipts.list ? <Loading /> : receipts.list.length === 0 ? <Empty>No payments yet.</Empty> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {receipts.list.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div><p className="font-medium text-slate-900">{p.receipt_no}</p><p className="text-slate-500">{fmtDateTime(p.paid_at)} · {p.method.replace('_', ' ')}</p></div>
                  <span className="tabular-nums">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end"><Btn tone="ghost" onClick={() => window.print()}>Print</Btn></div>
        </Modal>
      )}
    </section>
  );
}

function PaymentModal({ inv, onClose, onDone }) {
  const balance = Number(inv.amount) - Number(inv.amount_paid);
  const [amount, setAmount] = useState(String(balance)); const [method, setMethod] = useState('cash');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api.post(`/api/invoices/${inv.id}/payments`, { amount: Number(amount), method }); onDone(); }
    catch (x) { setErr(errorMessage(x)); setBusy(false); }
  };
  return (
    <Modal title={`Record payment: ${inv.invoice_no}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">{inv.student?.full_name} · balance {money(balance)}</p>
        <label className="block text-sm font-medium text-slate-700">Amount
          <input type="number" step="0.01" min="0.01" max={balance} required value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-md border-slate-300 text-sm" /></label>
        <label className="block text-sm font-medium text-slate-700">Method
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-md border-slate-300 text-sm">
            {['cash', 'card', 'bank_transfer', 'upi', 'other'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </select></label>
        <Alert>{err}</Alert>
        <div className="flex justify-end gap-2"><Btn type="button" tone="ghost" onClick={onClose}>Cancel</Btn><Btn tone="green" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Record payment'}</Btn></div>
      </form>
    </Modal>
  );
}