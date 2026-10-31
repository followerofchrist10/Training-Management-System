import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/security.js';
import { sendDbError } from '../middleware/errors.js';
import { rulesFor, pick, pagingRules, paging, meta, handleValidation, idParam, plain, likeSafe } from '../validators/schema.js';

const STAFF = ['staff', 'admin'];
const PROFILE = { full_name: { type: 'string', required: true, max: 120 }, phone: { type: 'string', max: 30, nullable: true } };
const DETAILS = {
  date_of_birth:    { type: 'date', nullable: true },
  address:          { type: 'string', max: 300, nullable: true },
  guardian_name:    { type: 'string', max: 120, nullable: true },
  guardian_phone:   { type: 'string', max: 30, nullable: true },
  learning_pathway: { type: 'string', max: 200, nullable: true },
};
const ALL = { ...PROFILE, ...DETAILS };
const SELECT = 'id, full_name, email, phone, is_active, created_at, details:student_details(*)';

async function save(sb, studentId, b) {
  const profile = pick(PROFILE, b);
  const details = pick(DETAILS, b);
  if (Object.keys(details).length) {
    const { error } = await sb.from('student_details').upsert({ student_id: studentId, ...details }, { onConflict: 'student_id' });
    if (error) return error;
  }
  if (Object.keys(profile).length) {
    const { error } = await sb.from('profiles').update(profile).eq('id', studentId);
    if (error) return error;
  }
  return null;
}

/* ---------------- Students (profile CRUD) ---------------- */
export const students = Router();
students.use(authenticate);

students.get('/me', requireRole('student'), async (req, res) => {
  const { data, error } = await req.sb.from('profiles').select(SELECT).eq('id', req.user.id).single();
  if (error) return sendDbError(res, error, req);
  res.json({ data });
});
students.put('/me', writeLimiter, requireRole('student'), rulesFor(ALL, { partial: true }), async (req, res) => {
  const err = await save(req.sb, req.user.id, req.body);
  if (err) return sendDbError(res, err, req);
  res.json({ ok: true });
});

students.get('/', requireRole(...STAFF), [...pagingRules, query('pathway').optional().isString().customSanitizer(plain).isLength({ max: 80 }), handleValidation], async (req, res) => {
  const { page, pageSize, from, to } = paging(req);
  const pathway = req.query.pathway;
  let q = req.sb.from('profiles')
    .select(pathway ? SELECT.replace('details:student_details(*)', 'details:student_details!inner(*)') : SELECT, { count: 'exact' })
    .eq('role', 'student');
  if (req.query.search) q = q.ilike('full_name', `%${likeSafe(req.query.search)}%`);
  if (pathway) q = q.ilike('details.learning_pathway', `%${likeSafe(pathway)}%`);
  const { data, count, error } = await q.order('full_name').range(from, to);
  if (error) return sendDbError(res, error, req);
  res.json({ data, meta: meta(page, pageSize, count) });
});

students.put('/:id', writeLimiter, requireRole(...STAFF), idParam, rulesFor(ALL, { partial: true }), async (req, res) => {
  const { data: target, error: e0 } = await req.sb.from('profiles').select('id, role').eq('id', req.params.id).single();
  if (e0) return sendDbError(res, e0, req);
  if (target.role !== 'student') return res.status(422).json({ error: 'Not a student account.' });
  const err = await save(req.sb, req.params.id, req.body);
  if (err) return sendDbError(res, err, req);
  res.json({ ok: true });
});

/* ---------------- Instructors (workload) + admin user management ---------------- */
export const instructors = Router();
instructors.use(authenticate, requireRole(...STAFF));
instructors.get('/', async (req, res) => {
  const { data, error } = await req.sb.rpc('instructor_workload');
  if (error) return sendDbError(res, error, req);
  res.json({ data: data.map((r) => ({ ...r, batches: Number(r.batches), students: Number(r.students) })) });
});

export const admin = Router();
admin.use(authenticate, requireRole('admin'));

admin.get('/users', [...pagingRules, query('role').optional().isIn(['admin', 'staff', 'instructor', 'student']), handleValidation], async (req, res) => {
  const { page, pageSize, from, to } = paging(req);
  let q = req.sb.from('profiles').select('id, full_name, email, role, is_active, created_at', { count: 'exact' });
  if (req.query.role) q = q.eq('role', req.query.role);
  if (req.query.search) q = q.ilike('full_name', `%${likeSafe(req.query.search)}%`);
  const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, to);
  if (error) return sendDbError(res, error, req);
  res.json({ data, meta: meta(page, pageSize, count) });
});

admin.patch('/users/:id', writeLimiter, idParam,
  body().isObject(), body().custom((b) => Object.keys(b).every((k) => ['role', 'is_active'].includes(k))).withMessage('Unexpected fields'),
  body('role').isIn(['admin', 'staff', 'instructor', 'student']),
  body('is_active').isBoolean({ strict: true }).toBoolean(true), handleValidation,
  async (req, res) => {
    const { data, error } = await req.sb.rpc('set_user_role', { p_id: req.params.id, p_role: req.body.role, p_active: req.body.is_active });
    if (error) return sendDbError(res, error, req);
    res.json({ data });
  });

admin.get('/logs', pagingRules.concat(handleValidation), async (req, res) => {
  const { page, pageSize, from, to } = paging(req, 30);
  const { data, count, error } = await req.sb.from('audit_logs')
    .select('id, actor_id, action, entity, entity_id, detail, created_at', { count: 'exact' })
    .order('id', { ascending: false }).range(from, to);
  if (error) return sendDbError(res, error, req);
  res.json({ data, meta: meta(page, pageSize, count) });
});