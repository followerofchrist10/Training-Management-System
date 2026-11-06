import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Alert, Btn } from '../components/ui';

const input = 'mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500';

function GoogleButton({ busy, onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="auth-google-button">
      <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.75 7.18l7.73 6C44.43 37.94 46.98 31.7 46.98 24.55Z" />
        <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.95 23.95 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 4)" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.45-4.88 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -4)" />
      </svg>
      <span>{busy ? 'Connecting to Google…' : 'Continue with Google'}</span>
    </button>
  );
}

async function signInWithGoogle(setErr, setBusy) {
  setErr('');
  setBusy(true);
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setErr(error.message);
      setBusy(false);
    }
  } catch (error) {
    setErr(error instanceof Error ? error.message : 'Unable to start Google sign-in.');
    setBusy(false);
  }
}

function Shell({ title, children, footer }) {
  const { pathname } = useLocation();
  const transition = pathname === '/register' ? 'auth-enter-forward' : 'auth-enter-back';

  return (
    <div className="auth-shell flex min-h-screen items-center justify-center px-4">
      <div className={`auth-content w-full max-w-sm ${transition}`}>
        <p className="auth-brand text-sm font-semibold uppercase tracking-wide text-slate-500">Training Center</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
        <div className="auth-panel mt-6 rounded-lg border border-slate-200 bg-white p-5">{children}</div>
        <p className="mt-4 text-center text-sm text-slate-600">{footer}</p>
      </div>
    </div>
  );
}

export function Login() {
  const { session } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (session) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setErr('Email or password is incorrect.');     // generic on purpose: no account enumeration
    setBusy(false);
  };
  return (
    <Shell title="Sign in" footer={<>New student? <Link to="/register" className="font-medium text-slate-900 underline">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></label>
        <label className="block text-sm font-medium text-slate-700">Password
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} /></label>
        <Alert>{err}</Alert>
        <Btn type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Btn>
      </form>
      <div className="auth-divider"><span>or</span></div>
      <GoogleButton busy={busy} onClick={() => signInWithGoogle(setErr, setBusy)} />
    </Shell>
  );
}

export function Register() {
  const { session } = useAuth();
  const [f, setF] = useState({ fullName: '', email: '', password: '' });
  const [err, setErr] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  if (session) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (f.fullName.trim().length < 2) return setErr('Enter your full name.');
    if (f.password.length < 10) return setErr('Use a password of at least 10 characters.');
    setBusy(true);
    // The role is NOT sent: the database trigger always creates a 'student' profile.
    const { data, error } = await supabase.auth.signUp({ email: f.email.trim(), password: f.password, options: { data: { full_name: f.fullName.trim() } } });
    setBusy(false);
    if (error) return setErr(error.message);
    if (!data.session) setDone(true);
  };

  if (done) return <Shell title="Check your email" footer={<Link to="/login" className="font-medium text-slate-900 underline">Back to sign in</Link>}>
    <p className="text-sm text-slate-700">We sent a confirmation link to {f.email}. Open it, then sign in.</p></Shell>;

  return (
    <Shell title="Create your account" footer={<>Already registered? <Link to="/login" className="font-medium text-slate-900 underline">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">Full name
          <input required maxLength={120} autoComplete="name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} className={input} /></label>
        <label className="block text-sm font-medium text-slate-700">Email
          <input type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} /></label>
        <label className="block text-sm font-medium text-slate-700">Password
          <input type="password" required minLength={10} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={input} />
          <span className="mt-1 block text-xs text-slate-500">At least 10 characters.</span></label>
        <Alert>{err}</Alert>
        <Btn type="submit" disabled={busy} className="w-full">{busy ? 'Creating…' : 'Create account'}</Btn>
      </form>
      <div className="auth-divider"><span>or</span></div>
      <GoogleButton busy={busy} onClick={() => signInWithGoogle(setErr, setBusy)} />
    </Shell>
  );
}
