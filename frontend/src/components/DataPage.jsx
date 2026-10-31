import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../lib/api';
import { useDebounced } from '../lib/hooks';
import { Alert, Btn, Empty, Loading, Modal, PageHeader, Pager, Pills, SearchBox } from './ui';

/**
 * Generic list + search + filter + create/edit/delete page over a /api resource.
 * fields:  { name, label, type: text|textarea|number|date|select|checkbox, required, options | optionsFrom:{endpoint,value,label} }
 * filters: { param, label, type: 'pills'|'select'|'number'|'date', options|optionsFrom }
 */
export default function DataPage({
  title, subtitle, endpoint, columns, fields = [], filters = [], searchable = true, searchPlaceholder,
  canCreate = false, canEdit = false, canDelete = false, updateMethod = 'patch', rowToForm, createLabel = 'Add new',
  baseParams = {}, pageSize = 15, emptyText = 'Nothing here yet.',
}) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const dSearch = useDebounced(search);
  const [fv, setFv] = useState({});                  // filter values
  const dFv = useDebounced(fv, 400);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);      // null | 'new' | row
  const [options, setOptions] = useState({});        // key -> [{value,label}]

  // Load select options (fields + filters) once.
  useEffect(() => {
    const srcs = [...fields, ...filters].filter((f) => f.optionsFrom);
    srcs.forEach((f) => {
      const key = f.name ?? f.param;
      api.get(f.optionsFrom.endpoint, { params: { pageSize: 100 } }).then((r) => {
        const list = r.data.data;
        setOptions((o) => ({ ...o, [key]: list.map((x) => ({ value: x[f.optionsFrom.value ?? 'id'], label: x[f.optionsFrom.label] })) }));
      }).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (signal) => {
    setLoading(true); setError('');
    try {
      const params = { ...baseParams, pageSize, page, search: dSearch || undefined };
      Object.entries(dFv).forEach(([k, v]) => { if (v !== '' && v != null) params[k] = v; });
      const r = await api.get(endpoint, { params, signal });
      setRows(r.data.data); setMeta(r.data.meta ?? null);
    } catch (e) { if (e.code !== 'ERR_CANCELED') setError(errorMessage(e)); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, dSearch, dFv, pageSize]);

  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort(); }, [load]);
  useEffect(() => { setPage(1); }, [dSearch, dFv]);

  const remove = async (row) => {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    try { await api.delete(`${endpoint}/${row.id}`); setNotice('Deleted.'); load(); } catch (e) { setError(errorMessage(e)); }
  };

  const fo = (f) => f.options ?? options[f.name ?? f.param] ?? [];

  return (
    <section>
      <PageHeader title={title} subtitle={subtitle}>
        {searchable && <SearchBox value={search} onChange={setSearch} placeholder={searchPlaceholder ?? 'Search'} />}
        {canCreate && <Btn onClick={() => setEditing('new')}>{createLabel}</Btn>}
      </PageHeader>

      {filters.length > 0 && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          {filters.map((f) => f.type === 'pills' ? (
            <Pills key={f.param} label={f.label} value={fv[f.param] ?? ''} onChange={(v) => setFv((s) => ({ ...s, [f.param]: v }))}
              options={f.options} />
          ) : (
            <label key={f.param} className="text-sm text-slate-600">
              <span className="mb-1 block">{f.label}</span>
              {f.type === 'select' ? (
                <select value={fv[f.param] ?? ''} onChange={(e) => setFv((s) => ({ ...s, [f.param]: e.target.value }))} className="rounded-md border-slate-300 text-sm">
                  <option value="">All</option>
                  {fo(f).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input type={f.type} min={f.type === 'number' ? 0 : undefined} value={fv[f.param] ?? ''}
                  onChange={(e) => setFv((s) => ({ ...s, [f.param]: e.target.value }))} className="rounded-md border-slate-300 text-sm" />
              )}
            </label>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2" aria-live="polite">
        <Alert tone="ok">{notice}</Alert>
        <Alert onRetry={() => load()}>{error}</Alert>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left font-medium text-slate-600">
            <tr>
              {columns.map((c) => <th key={c.label} scope="col" className="whitespace-nowrap px-4 py-3">{c.label}</th>)}
              {(canEdit || canDelete) && <th scope="col" className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                {columns.map((c) => <td key={c.label} className="px-4 py-3 text-slate-700">{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>)}
                {(canEdit || canDelete) && (
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex gap-2">
                      {canEdit && <Btn tone="ghost" onClick={() => setEditing(row)}>Edit</Btn>}
                      {canDelete && <Btn tone="danger" onClick={() => remove(row)}>Delete</Btn>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {loading && rows.length === 0 && <Loading />}
        {!loading && !error && rows.length === 0 && <Empty>{search || Object.values(fv).some(Boolean) ? 'No matches. Clear the search or filters.' : emptyText}</Empty>}
      </div>
      <Pager page={page} meta={meta} setPage={setPage} loading={loading} />

      {editing && (
        <RecordForm
          title={editing === 'new' ? createLabel : 'Edit record'} fields={fields} optionsFor={fo}
          initial={editing === 'new' ? {} : (rowToForm ? rowToForm(editing) : editing)} isNew={editing === 'new'}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            if (editing === 'new') await api.post(endpoint, payload);
            else await api[updateMethod](`${endpoint}/${editing.id}`, payload);
            setEditing(null); setNotice('Saved.'); load();
          }}
        />
      )}
    </section>
  );
}

function RecordForm({ title, fields, optionsFor, initial, isNew, onClose, onSubmit }) {
  const [v, setV] = useState(() => Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? (f.type === 'checkbox' ? (isNew ? true : false) : '')])));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (n, val) => setV((s) => ({ ...s, [n]: val }));

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    for (const f of fields) if (f.required && (v[f.name] === '' || v[f.name] == null)) return setErr(`${f.label} is required.`);
    const payload = {};
    for (const f of fields) {
      const val = v[f.name];
      if (f.type === 'checkbox') payload[f.name] = !!val;
      else if (val === '' || val == null) { if (!isNew) payload[f.name] = null; }
      else payload[f.name] = f.type === 'number' ? Number(val) : typeof val === 'string' ? val.trim() : val;
    }
    setBusy(true);
    try { await onSubmit(payload); } catch (x) { setErr(errorMessage(x)); setBusy(false); }
  };

  const cls = 'mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500';
  return (
    <Modal title={title} onClose={onClose} wide={fields.length > 6}>
      <form onSubmit={submit} className="space-y-3">
        {fields.map((f) => (
          <div key={f.name}>
            {f.type === 'checkbox' ? (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={!!v[f.name]} onChange={(e) => set(f.name, e.target.checked)} className="rounded border-slate-300" /> {f.label}
              </label>
            ) : (
              <label className="block text-sm font-medium text-slate-700">
                {f.label}{f.required && <span className="text-rose-600"> *</span>}
                {f.type === 'textarea' ? <textarea rows={4} value={v[f.name]} onChange={(e) => set(f.name, e.target.value)} className={cls} />
                  : f.type === 'select' ? (
                    <select value={v[f.name]} onChange={(e) => set(f.name, e.target.value)} className={cls}>
                      <option value="">{f.required ? 'Select…' : 'None'}</option>
                      {optionsFor(f).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : <input type={f.type ?? 'text'} step={f.type === 'number' ? '0.01' : undefined} value={v[f.name]} onChange={(e) => set(f.name, e.target.value)} className={cls} />}
              </label>
            )}
            {f.help && <p className="mt-1 text-xs text-slate-500">{f.help}</p>}
          </div>
        ))}
        <Alert>{err}</Alert>
        <div className="flex justify-end gap-2 pt-2">
          <Btn type="button" tone="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn>
        </div>
      </form>
    </Modal>
  );
}