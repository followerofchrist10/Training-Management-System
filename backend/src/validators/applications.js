import { body, param, query, validationResult } from 'express-validator';

const STATUSES = ['pending', 'under_review', 'approved', 'rejected', 'cancelled'];

// XSS: strip any markup, control chars, and collapse whitespace. We store plain text and
// React escapes on output; HTML-escaping here as well would double-encode ("&amp;amp;").
const plain = (v) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();

export const handleValidation = (req, res, next) => {
  const r = validationResult(req);
  if (r.isEmpty()) return next();
  return res.status(422).json({
    error: 'Validation failed',
    details: r.array({ onlyFirstError: true }).map((e) => ({ field: e.path, message: e.msg })),
  });
};

const idParam = param('id').isUUID().withMessage('Invalid id');

export const validateCreate = [
  body().isObject().withMessage('Body must be a JSON object'),
  body('batchId').isUUID().withMessage('batchId must be a UUID'),
  body('motivation').optional({ values: 'falsy' }).isString().customSanitizer(plain)
    .isLength({ max: 2000 }).withMessage('Motivation must be 2000 characters or fewer'),
  body().custom((b) => Object.keys(b).every((k) => ['batchId', 'motivation'].includes(k)))
    .withMessage('Unexpected fields'),                // blocks mass-assignment (status, student_id, ...)
  handleValidation,
];

export const validateList = [
  query('status').optional().isIn(STATUSES).withMessage('Unknown status'),
  query('search').optional().isString().customSanitizer(plain).isLength({ max: 80 }),
  query('batchId').optional().isUUID(),
  query('from').optional().isISO8601({ strict: true }).toDate(),
  query('to').optional().isISO8601({ strict: true }).toDate(),
  query('page').optional().isInt({ min: 1, max: 10000 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().isIn(['submitted_at', 'status']),
  query('dir').optional().isIn(['asc', 'desc']),
  handleValidation,
];

export const validateTransition = [
  idParam,
  body('status').isIn(['under_review', 'approved', 'rejected']).withMessage('Invalid target status'),
  body('notes').optional({ values: 'falsy' }).isString().customSanitizer(plain)
    .isLength({ max: 1000 }).withMessage('Notes must be 1000 characters or fewer'),
  body('notes').if(body('status').equals('rejected')).notEmpty().withMessage('A reason is required to reject'),
  handleValidation,
];

export const validateId = [idParam, handleValidation];