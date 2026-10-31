import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/security.js';
import { sendDbError } from '../middleware/errors.js';
import { pagingRules, paging, meta, handleValidation, idParam, validateId, plain, likeSafe } from '../validators/schema.js';

const STAFF = ['staff', 'admin'];
const dateQ = (n) => query(n).optional().isDate({ format: 'YYYY-MM-DD', strictMode: true, delimiters: ['-'] });

/* ---------------- /api/me ---------------- */
export const me = Router();
me.get('/', authenticate, async (req, res) => {
  const { data, error } = await req.sb.from('profiles').select('id, role, full_name, email, phone').eq('id', req.user.id).single();
  if (error) return sendDbError(res, error, req);
  res.json({ data });
});

/* ---------------- Catalogue + roster ---------------- */
export const catalog = Router();
catalog.use(authenticate);
catalog.get('/open-batches', async (req, res) => {
  const { data, error } = await req.sb.rpc('open_batches');
  if (error) return sendDbError(res, error, req);
  res.json({ data });
});
catalog.get('/roster/:batchId', param('batchId').isUUID(), handleValidation, async (req, res) => {
  const { data, error } = await req.sb.rpc('batch_roster', { p_batch: req.params.batchId });
  if (error) return sendDbError(res, error, req);
  res.json({ data });
});

/* ---------------- Dashboard ---------------- */
export const dashboard = Router();
dashboard.use(authenticate);
dashboard.get('/', async (req, res) => {
  const { data, error } = await req.sb.rpc('dashboard_summary');
  if (error) return sendDbError(res, error, req);
  res.json({ data });
});
dashboard.get('/activity', async (req, res) => {
  if (STAFF.includes(req.user.role)) {
    const { data, error } = await req.sb.from('application_status_history')
      .select('id, to_status, notes, changed_at, application:applications(student:profiles!applications_student_id_fkey(full_name), batch:batches(name))')
      .order('id', { ascending: false }).limit(15);
    if (error) return sendDbError(res, error, req);
    return res.json({ data: data.map((h) => ({
      id: `h${h.id}`, at: h.changed_at,
      text: `${h.application?.student?.full_name ?? 'A student'} — ${h.to_status.replace('_', ' ')} (${h.application?.batch?.name ?? 'batch'})`,
    })) });
  }
  const { data, error } = await req.sb.from('notifications').select('id, title, body, created_at')
    .order('created_at', { ascending: false }).limit(10);
  if (error) return sendDbError(res, error, req);
  res.json({ data: data.map((n) => ({ id: n.id, at: n.created_at, text: n.title, sub: n.body })) });
});

/* ---------------- Notifications ---------------- */
export const notifications = Router();
notifications.use(authenticate);
notifications.get('/', pagingRules.concat(handleValidation), async (req, res) => {
  const { page, pageSize, from, to } = paging(req);
  const { data, count, error } = await req.sb.from('notifications').select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).range(from, to);
  if (error) return sendDbError(res, error, req);
  const unread = await req.sb.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false);
  res.json({ data, meta: { ...meta(page, pageSize, count), unread: unread.count ?? 0 } });
});
notifications.post('/read-all', writeLimiter, async (req, res) => {
  const { error } = await req.sb.from('notifications').update({ is_read: true }).eq('is_read', false);
  if (error) return sendDbError(res, error, req);
  res.json({ ok: true });
});
notifications.patch('/:id/read', writeLimiter, validateId, async (req, res) => {
  const { error } = await req.sb.from('notifications').update({ is_read: true }).eq('id', req.params.id);
  if (error) return sendDbError(res, error, req);
  res.json({ ok: true });
});

/* ---------------- Invoices & payments ---------------- */
export const invoices = Router();
invoices.use(authenticate);
const INV = `id, invoice_no, amount, amount_paid, status, due_on, issued_at,
  student:profiles!inner(id, full_name, email),
  application:applications(batch:batches(name, course:courses(title)))`;

invoices.get('/', [...pagingRules, query('status').optional().isIn(['unpaid', 'partial', 'paid', 'void']), dateQ('dueBefore'), handleValidation], async (req, res) => {
  const { page, pageSize, from, to } = paging(req);
  let q = req.sb.from('invoices').select(INV, { count: 'exact' });
  if (req.query.status) q = q.eq('status', req.query.status);
  if (req.query.dueBefore) q = q.lte('due_on', req.query.dueBefore);
  if (req.query.search) q = q.ilike('student.full_name', `%${likeSafe(req.query.search)}%`);
  const { data, count, error } = await q.order('issued_at', { ascending: false }).range(from, to);
  if (error) return sendDbError(res, error, req);
  res.json({ data, meta: meta(page, pageSize, count) });
});
invoices.get('/:id/payments', validateId, async (req, res) => {
  const { data, error } = await req.sb.from('payments').select('id, amount, method, receipt_no, paid_at')
    .eq('invoice_id', req.params.id).order('paid_at', { ascending: false });
  if (error) return sendDbError(res, error, req);
  res.json({ data });
});
invoices.post('/:id/payments', writeLimiter, requireRole(...STAFF), idParam,
  body().custom((b) => Object.keys(b).every((k) => ['amount', 'method'].includes(k))).withMessage('Unexpected fields'),
  body('amount').isFloat({ gt: 0, max: 10_000_000 }).withMessage('Enter a positive amount').toFloat(),
  body('method').isIn(['cash', 'card', 'bank_transfer', 'upi', 'other']), handleValidation,
  async (req, res) => {
    const { data, error } = await req.sb.rpc('record_payment', { p_invoice: req.params.id, p_amount: req.body.amount, p_method: req.body.method });
    if (error) return sendDbError(res, error, req);
    res.status(201).json({ data });
  });

/* ---------------- Attendance ---------------- */
export const attendance = Router();
attendance.use(authenticate);
attendance.get('/', [query('batchId').optional().isUUID(), dateQ('date'), dateQ('from'), dateQ('to'), handleValidation], async (req, res) => {
  let q = req.sb.from('attendance').select('id, batch_id, student_id, on_date, status, batch:batches(name)');
  if (req.query.batchId) q = q.eq('batch_id', req.query.batchId);
  if (req.query.date) q = q.eq('on_date', req.query.date);
  if (req.query.from) q = q.gte('on_date', req.query.from);
  if (req.query.to) q = q.lte('on_date', req.query.to);
  const { data, error } = await q.order('on_date', { ascending: false }).limit(1000);
  if (error) return sendDbError(res, error, req);
  res.json({ data });
});
attendance.put('/', writeLimiter, requireRole('instructor'),
  body().custom((b) => Object.keys(b).every((k) => ['batchId', 'date', 'records'].includes(k))).withMessage('Unexpected fields'),
  body('batchId').isUUID(),
  body('date').isDate({ format: 'YYYY-MM-DD', strictMode: true, delimiters: ['-'] }),
  body('records').isArray({ min: 1, max: 200 }),
  body('records.*.studentId').isUUID(),
  body('records.*.status').isIn(['present', 'absent', 'late', 'excused']), handleValidation,
  async (req, res) => {
    const { batchId, date, records } = req.body;
    if (date > new Date().toISOString().slice(0, 10)) return res.status(422).json({ error: 'Cannot mark attendance for a future date.' });
    const rows = records.map((r) => ({ batch_id: batchId, student_id: r.studentId, on_date: date, status: r.status, marked_by: req.user.id }));
    const { error } = await req.sb.from('attendance').upsert(rows, { onConflict: 'batch_id,student_id,on_date' });
    if (error) return sendDbError(res, error, req);   // RLS rejects batches the caller doesn't teach / students not enrolled
    res.json({ ok: true, saved: rows.length });
  });

/* ---------------- Reports ---------------- */
export const reports = Router();
reports.use(authenticate, requireRole(...STAFF));
const months = query('months').optional().isInt({ min: 1, max: 36 }).toInt();
reports.get('/revenue', requireRole('admin'), months, handleValidation, async (req, res) => {
  const { data, error } = await req.sb.rpc('report_monthly_revenue', { p_months: req.query.months ?? 12 });
  if (error) return sendDbError(res, error, req);
  res.json({ data: data.map((r) => ({ ...r, revenue: Number(r.revenue), payments: Number(r.payments) })) });
});
reports.get('/enrollment', months, handleValidation, async (req, res) => {
  const { data, error } = await req.sb.rpc('report_enrollment_trend', { p_months: req.query.months ?? 12 });
  if (error) return sendDbError(res, error, req);
  res.json({ data: data.map((r) => ({ ...r, submitted: Number(r.submitted), approved: Number(r.approved), rejected: Number(r.rejected) })) });
});
reports.get('/courses', async (req, res) => {
  const { data, error } = await req.sb.rpc('report_course_enrollment');
  if (error) return sendDbError(res, error, req);
  res.json({ data: data.map((r) => ({ ...r, enrolled: Number(r.enrolled), invoiced: r.invoiced == null ? null : Number(r.invoiced), collected: r.collected == null ? null : Number(r.collected) })) });
});