import { sendDbError } from '../middleware/errors.js';

// Escape LIKE wildcards so user input can't turn into pattern matching tricks.
// The value itself is still sent as a bound PostgREST parameter (no SQL string building).
const likeSafe = (s) => s.replace(/[\\%_]/g, '\\$&');

const LIST_SELECT = `
  id, status, motivation, review_notes, submitted_at, reviewed_at, batch_id,
  student:profiles!applications_student_id_fkey!inner ( id, full_name, email, phone ),
  batch:batches!inner ( id, name, starts_on, course:courses!inner ( id, code, title, price ) )
`;

/** POST /api/applications  (student) */
export async function createApplication(req, res) {
  const { batchId, motivation } = req.body;
  const { data, error } = await req.sb
    .from('applications')
    .insert({ student_id: req.user.id, batch_id: batchId, motivation: motivation ?? null })
    .select('id, status, submitted_at, batch_id')
    .single();
  if (error) return sendDbError(res, error, req);
  res.status(201).json({ data });
}

/** GET /api/applications  (student: own rows; staff/admin: all) — RLS decides which. */
export async function listApplications(req, res) {
  const { status, search, batchId, from, to, page = 1, pageSize = 20, sort = 'submitted_at', dir = 'desc' } = req.query;

  let q = req.sb.from('applications').select(LIST_SELECT, { count: 'exact' });
  if (status)  q = q.eq('status', status);
  if (batchId) q = q.eq('batch_id', batchId);
  if (from)    q = q.gte('submitted_at', from.toISOString());
  if (to)      q = q.lte('submitted_at', to.toISOString());
  if (search)  q = q.ilike('student.full_name', `%${likeSafe(search)}%`);

  const start = (page - 1) * pageSize;
  q = q.order(sort, { ascending: dir === 'asc' }).range(start, start + pageSize - 1);

  const { data, count, error } = await q;
  if (error) return sendDbError(res, error, req);
  res.json({ data, meta: { page, pageSize, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / pageSize) } });
}

/** GET /api/applications/summary  (staff) — counts per status for filter pills. */
export async function statusCounts(req, res) {
  const statuses = ['pending', 'under_review', 'approved', 'rejected'];
  const results = await Promise.all(statuses.map((s) =>
    req.sb.from('applications').select('id', { count: 'exact', head: true }).eq('status', s)));
  const failed = results.find((r) => r.error);
  if (failed) return sendDbError(res, failed.error, req);
  res.json({ data: Object.fromEntries(statuses.map((s, i) => [s, results[i].count ?? 0])) });
}

/** GET /api/applications/:id  (+ history) */
export async function getApplication(req, res) {
  const { data, error } = await req.sb.from('applications')
    .select(`${LIST_SELECT}, history:application_status_history ( from_status, to_status, notes, changed_at )`)
    .eq('id', req.params.id).single();
  if (error) return sendDbError(res, error, req);
  res.json({ data });
}

/** PATCH /api/applications/:id/status  (staff/admin) — all rules live in the SQL function. */
export async function transitionApplication(req, res) {
  const { data, error } = await req.sb.rpc('transition_application', {
    p_id: req.params.id, p_to: req.body.status, p_notes: req.body.notes ?? null,
  });
  if (error) return sendDbError(res, error, req);
  res.json({ data });
}

/** POST /api/applications/:id/cancel  (student, own application) */
export async function cancelApplication(req, res) {
  const { data, error } = await req.sb.rpc('cancel_application', { p_id: req.params.id });
  if (error) return sendDbError(res, error, req);
  res.json({ data });
}