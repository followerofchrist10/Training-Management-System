import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import api from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);   // undefined = still loading
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id;
  useEffect(() => {
    if (!uid) { setProfile(null); setProfileError(false); return; }
    let live = true;
    api.get('/api/me')
      .then((r) => live && (setProfile(r.data.data), setProfileError(false)))
      .catch(() => live && setProfileError(true));
    return () => { live = false; };
  }, [uid]);

  const value = {
    session, profile, profileError,
    loading: session === undefined || (!!session && !profile && !profileError),
    signOut: () => supabase.auth.signOut(),
    refreshProfile: () => api.get('/api/me').then((r) => setProfile(r.data.data)),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}