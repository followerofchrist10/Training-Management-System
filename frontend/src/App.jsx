import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import ApplicationTracker from './components/ApplicationTracker';
import { Login, Register } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Apply from './pages/Apply';
import Invoices from './pages/Invoices';
import Attendance from './pages/Attendance';
import Grades from './pages/Grades';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import MyProfile from './pages/MyProfile';
import { Courses, Batches, Assets, Students, Instructors, Users, AuditLog } from './pages/Resources';

const STAFF = ['staff', 'admin'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="notifications" element={<Notifications />} />

          <Route element={<ProtectedRoute roles={STAFF} />}>
            <Route path="applications" element={<ApplicationTracker />} />
            <Route path="students" element={<Students />} />
            <Route path="courses" element={<Courses />} />
            <Route path="instructors" element={<Instructors />} />
            <Route path="assets" element={<Assets />} />
            <Route path="reports" element={<Reports />} />
          </Route>
          <Route element={<ProtectedRoute roles={[...STAFF, 'instructor']} />}>
            <Route path="batches" element={<Batches />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="users" element={<Users />} />
            <Route path="audit" element={<AuditLog />} />
          </Route>
          <Route element={<ProtectedRoute roles={['student']} />}>
            <Route path="apply" element={<Apply />} />
            <Route path="my-profile" element={<MyProfile />} />
          </Route>
          <Route element={<ProtectedRoute roles={[...STAFF, 'student']} />}>
            <Route path="invoices" element={<Invoices />} />
          </Route>
          <Route element={<ProtectedRoute roles={['instructor', 'student']} />}>
            <Route path="attendance" element={<Attendance />} />
            <Route path="grades" element={<Grades />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}