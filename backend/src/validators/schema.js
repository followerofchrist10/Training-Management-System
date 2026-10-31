import { body, query, param, validationResult } from 'express-validator';

// Strip markup + control chars. We store plain text; React escapes on output.
export const plain = (v) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
export const likeSafe = (s) => s.replace(/[\\%_]/g, '\\$&');

export const handleValidation = (req, res, next) => {
  const r = validationResult(req);
  if (r.isEmpty()) return next();
  res.status(422).json({
    error: 'Validation failed',
    details: r.array({ onlyFirstError: true }).map((e) => ({ field: e.path, message: e.msg })),
  });
};

export const idParam = param('id').isUUID().withMessage('Invalid id');
export const validateId = [idParam, handleValidation];

export const pagingRules = [
  query('page').optional().isInt({ min: 1, max: 10000 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().isString().customSanitizer(plain).isLength({ max: 80 }),
];
export const paging = (req, dflt = 20) => {
  const page = req.query.page ?? 1; const pageSize = req.query.pageSize ?? dflt;
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
};
export const meta = (page, pageSize, total) => ({ page, pageSize, total: total ?? 0, totalPages: Math.max(1, Math.ceil((total ?? 0) / pageSize)) });

/** Field types -> express-validator chains. Schema entry: { type, required, max, min, values, nullable } */
const types = {
  string: (c, o) => c.isString().withMessage('Must be text').bail()
    .customSanitizer((v) => { const s = plain(v); return !o.required && s === '' ? null : s; })
    .isLength({ min: o.required ? 1 : 0, max: o.max ?? 200 }).withMessage(o.required ? `Required, up to ${o.max ?? 200} characters` : `Up to ${o.max ?? 200} characters`),
  uuid:   (c) => c.isUUID().withMessage('Must be a valid id'),
  int:    (c, o) => c.isInt({ min: o.min ?? 0, max: o.max ?? 1_000_000 }).withMessage('Must be a whole number').toInt(),
  number: (c, o) => c.isFloat({ min: o.min ?? 0, max: o.max ?? 10_000_000 }).withMessage('Must be a number').toFloat(),
  date:   (c) => c.isDate({ format: 'YYYY-MM-DD', strictMode: true, delimiters: ['-'] }).withMessage('Use YYYY-MM-DD'),
  bool:   (c) => c.isBoolean({ strict: true }).withMessage('Must be true or false').toBoolean(true),
  email:  (c) => c.isEmail().withMessage('Invalid email').normalizeEmail(),
  enum:   (c, o) => c.isIn(o.values).withMessage(`Must be one of: ${o.values.join(', ')}`),
};

export function rulesFor(schema, { partial = false } = {}) {
  const chains = Object.entries(schema).map(([name, o]) => {
    let c = body(name);
    if (partial || !o.required) c = c.optional({ values: o.nullable ? 'null' : 'undefined' });
    else c = c.exists({ values: 'null' }).withMessage('Required').bail();
    return types[o.type](c, o);
  });
  const unknown = body().custom((b) => Object.keys(b ?? {}).every((k) => k in schema)).withMessage('Unexpected fields');   // mass-assignment guard
  const nonEmpty = partial ? [body().custom((b) => Object.keys(b ?? {}).length > 0).withMessage('Nothing to update')] : [];
  return [body().isObject().withMessage('Body must be a JSON object'), unknown, ...nonEmpty, ...chains, handleValidation];
}

export const pick = (schema, b) =>
  Object.fromEntries(Object.keys(schema).filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));