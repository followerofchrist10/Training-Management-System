import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL, timeout: 15000 });

// Attach the current (auto-refreshed) Supabase access token to every request.
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  if (data.session) config.headers.Authorization = `Bearer ${data.session.access_token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) supabase.auth.signOut();   // session expired -> back to login
    return Promise.reject(err);
  },
);

export const errorMessage = (err) =>
  err.response?.data?.details?.[0]?.message ??
  err.response?.data?.error ??
  (err.code === 'ECONNABORTED' ? 'The request timed out.' : 'Could not reach the server.');

export default api;