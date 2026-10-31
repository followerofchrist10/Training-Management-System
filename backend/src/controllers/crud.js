import { Router } from 'express';
import { query } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/security.js';
import { sendDbError } from '../middleware/errors.js';
import { rulesFor, pick, pagingRules, paging, meta, handleValidation, validateId, plain, likeSafe } from '../validators/schema.js';

/**
 * Generic, RLS-backed CRUD router.
 *  - schema      whitelist + validation for writable fields (snake_case = column names)
 *  - filters     columns filterable with ?col=value (.eq)
 *  - gte         { queryParam: column } filterable with .gte
 *  - immutable   fields allowed on create but not on update
 *  - inject      server-controlled columns merged into inserts (e.g. graded_by)
 * Authorisation is enforced by Postgres RLS; requireRole is only an early exit.
 */
export function crudRouter({ table, select = '*', schema, searchCol, filters = [], gte = {},
  order = { col: 'created_at', asc: false }, writeRoles = [], deleteRoles = [], immutable = [], inject }) {
  const r = Router();
  r.use(authenticate);

  const updateSchema = Object.fromEntries(Object.entries(schema).filter(([k]) => !immutable.includes(k)));
  const listRules = [
    ...pagingRules,
    ...filters.map((f) => query(f).optional().isString().customSanitizer(plain).isLength({ max: 64 })),
    ...Object.keys(gte).map((p) => query(p).optional().isString().customSanitizer(plain).isLength({ max: 32 })),
    handleValidation,
  ];

  r.get('/', listRules, async (req, res) => {
    const { page, pageSize, from, to } = paging(req);
    let q = req.sb.from(table).select(select, { count: 'exact' });
    if (req.query.search && searchCol) q = q.ilike(searchCol, `%${likeSafe(req.query.search)}%`);
    for (const f of filters) if (req.query[f] !== undefined) q = q.eq(f, req.query[f]);
    for (const [p, col] of Object.entries(gte)) if (req.query[p] !== undefined) q = q.gte(col, req.query[p]);
    const { data, count, error } = await q.order(order.col, { ascending: order.asc }).range(from, to);
    if (error) return sendDbError(res, error, req);
    res.json({ data, meta: meta(page, pageSize, count) });
  });

  r.get('/:id', validateId, async (req, res) => {
    const { data, error } = await req.sb.from(table).select(select).eq('id', req.params.id).single();
    if (error) return sendDbError(res, error, req);
    res.json({ data });
  });

  if (writeRoles.length) {
    r.post('/', writeLimiter, requireRole(...writeRoles), rulesFor(schema), async (req, res) => {
      const row = { ...pick(schema, req.body), ...(inject?.(req) ?? {}) };
      const { data, error } = await req.sb.from(table).insert(row).select(select).single();
      if (error) return sendDbError(res, error, req);
      res.status(201).json({ data });
    });
    r.patch('/:id', writeLimiter, requireRole(...writeRoles), validateId, rulesFor(updateSchema, { partial: true }), async (req, res) => {
      const { data, error } = await req.sb.from(table).update(pick(updateSchema, req.body))
        .eq('id', req.params.id).select(select).single();
      if (error) return sendDbError(res, error, req);
      res.json({ data });
    });
  }
  if (deleteRoles.length) {
    r.delete('/:id', writeLimiter, requireRole(...deleteRoles), validateId, async (req, res) => {
      const { data, error } = await req.sb.from(table).delete().eq('id', req.params.id).select('id');
      if (error) return sendDbError(res, error, req);
      if (!data?.length) return res.status(404).json({ error: 'Not found.' });
      res.status(204).end();
    });
  }
  return r;
}