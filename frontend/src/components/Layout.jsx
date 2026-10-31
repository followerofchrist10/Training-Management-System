import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import api from '../lib/api';
import { useRealtime } from '../lib/realtime';

const NAV = {
  admin: [['/', 'Dashboard'], ['/applications', 'Applications'], ['/students', 'Students'], ['/courses', 'Courses'], ['/batches', 'Batches'], ['/instructors', 'Instructors'], ['/assets', 'Rooms and labs'], ['/invoices', 'Invoices'], ['/reports', 'Reports'], ['/users', 'Users and roles'], ['/audit', 'System logs']],
  staff: [['/', 'Dashboard'], ['/applications', 'Applications'], ['/students', 'Students'], ['/courses', 'Courses'], ['/batches', 'Batches'], ['/instructors', 'Instructors'], ['/assets', 'Rooms and labs'], ['/invoices', 'Invoices'], ['/reports', 'Reports']],
  instructor: [['/', 'Dashboard'], ['/batches', 'My batches'], ['/attendance', 'Attendance'], ['/grades', 'Grades']],
  student: [['/', 'Dashboard'], ['/apply', 'Apply and track'], ['/invoices', 'Fees and receipts'], ['/attendance', 'My attendance'], ['/grades', 'My grades'], ['/my-profile', 'My profile']],
};

export default function Layout() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const refreshUnread = () => api.get('/api/notifications', { params: { pageSize: 1 } }).then((r) => setUnread(r.data.meta.unread)).catch(() => {});
  useEffect(() => { refreshUnread(); }, []);
  useRealtime('notifications', refreshUnread);

  const link = ({ isActive }) => `block rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`;

  const nav = (
    <nav className="space-y-1" aria-label="Main">
      {NAV[profile.role].map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className={link}>{label}</NavLink>)}
      <NavLink to="/notifications" className={link}>
        Notifications {unread > 0 && <span className="ml-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-xs text-white">{unread}</span>}
      </NavLink>
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
        <p className="mb-4 px-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Training Center</p>
        {nav}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <button className="rounded-md p-2 text-slate-700 ring-1 ring-inset ring-slate-300 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <span className="hidden text-sm text-slate-500 md:block capitalize">{profile.role}</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="max-w-[10rem] truncate text-slate-700">{profile.full_name}</span>
            <button onClick={signOut} className="rounded-md px-2.5 py-1.5 font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50">Sign out</button>
          </div>
        </header>

        {open && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-64 bg-white p-4 shadow-xl">{nav}</div>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6"><Outlet /></main>
      </div>
    </div>
  );
}