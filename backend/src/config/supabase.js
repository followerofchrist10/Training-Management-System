import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Missing SUPABASE_URL / SUPABASE_ANON_KEY');

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Anonymous client: used ONLY to verify a JWT via auth.getUser(). */
export const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);

/**
 * Per-request client that acts AS the caller. Postgres sees auth.uid() = caller,
 * so RLS is enforced on every query. We deliberately do NOT use the service-role
 * key anywhere in request handling: a bug here can't leak another tenant's rows.
 */
export const clientForToken = (accessToken) =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...opts,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });