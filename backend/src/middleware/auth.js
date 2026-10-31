import { anonClient, clientForToken } from '../config/supabase.js';

/** Verifies the Supabase JWT, loads the profile, attaches req.user and req.sb (RLS-scoped client). */
export async function authenticate(req, res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token || token.length > 4096) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const { data, error } = await anonClient.auth.getUser(token);   // validates signature + expiry server-side
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired session' });

    const sb = clientForToken(token);
    const { data: profile, error: pErr } = await sb
      .from('profiles').select('id, role, full_name, is_active').eq('id', data.user.id).single();
    if (pErr || !profile || !profile.is_active) return res.status(403).json({ error: 'Account unavailable' });

    req.user = { id: profile.id, role: profile.role, name: profile.full_name };
    req.sb = sb;
    next();
  } catch (e) {
    next(e);
  }
}

/** Role gate. This is UX/early-exit; the real enforcement is RLS + the SQL functions. */
export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Forbidden' });