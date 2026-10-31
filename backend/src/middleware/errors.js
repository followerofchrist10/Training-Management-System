/** Maps Postgres/PostgREST errors to safe HTTP responses. Never forwards raw DB messages to clients. */
const PG = {
  '23505': [409, 'You already have an active application for this batch.'],
  '23503': [422, 'Referenced record does not exist.'],
  '23514': [422, 'A value is outside the allowed range.'],
  '42501': [403, 'You do not have permission to do that.'],
  'P0002': [404, 'Not found.'],
  'PGRST116': [404, 'Not found.'],        // .single() matched 0 rows (also what RLS-hidden rows look like)
};
// P0001 = our own RAISE EXCEPTION business-rule messages: safe to show.
export function sendDbError(res, error, req) {
  if (error?.code === 'P0001') return res.status(422).json({ error: error.message });
  const [status, message] = PG[error?.code] ?? [500, 'Something went wrong.'];
  if (status === 500) console.error('[db]', req?.id ?? '', error?.code, error?.message);
  return res.status(status).json({ error: message });
}

export const notFound = (_req, res) => res.status(404).json({ error: 'Not found' });

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Something went wrong.' });
};