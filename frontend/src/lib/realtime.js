import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

/** Calls onChange whenever a row in `table` changes. RLS limits what each user is notified about. */
export function useRealtime(table, onChange) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const ch = supabase.channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => cb.current?.())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [table]);
}