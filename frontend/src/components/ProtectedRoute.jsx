import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Loading, Btn } from './ui';

export default function ProtectedRoute({ roles }) {
  const { session, profile, loading, profileError, signOut } = useAuth();
  if (loading) return <Loading label="Signing you in…" />;
  if (!session) return <Navigate to="/login" replace />;
  if (profileError || !profile) {
    return (
      <div className="mx-auto mt-24 max-w-sm text-center">
        <p className="text-sm text-slate-700">Your account is unavailable or the server can't be reached.</p>
        <Btn className="mt-4" onClick={signOut}>Sign out</Btn>
      </div>
    );
  }
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}