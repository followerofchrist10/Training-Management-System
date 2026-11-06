import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Alert, Btn } from '../components/ui';

const input = 'mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500';

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
    </Shell>
  );
}
