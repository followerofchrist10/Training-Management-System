import DataPage from '../components/DataPage';
import { Badge, fmtDate, fmtDateTime, money } from '../components/ui';
import { useAuth } from '../lib/auth';

const isStaff = (p) => ['staff', 'admin'].includes(p.role);

export function Courses() {
  const { profile } = useAuth();
  return (
    <DataPage title="Courses" subtitle="Syllabi and pricing." endpoint="/api/courses" searchPlaceholder="Search by title"
      canCreate={isStaff(profile)} canEdit={isStaff(profile)} canDelete={profile.role === 'admin'} createLabel="Add course"
      filters={[
        { param: 'is_active', label: 'Status', type: 'pills', options: [{ value: '', label: 'All' }, { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
        { param: 'minPrice', label: 'Minimum price', type: 'number' },
      ]}
      columns={[
        { label: 'Code', key: 'code' }, { label: 'Title', render: (r) => <span className="font-medium text-slate-900">{r.title}</span> },
        { label: 'Price', render: (r) => money(r.price) }, { label: 'Status', render: (r) => <Badge value={r.is_active ? 'active' : 'inactive'} /> },
      ]}
      fields={[
        { name: 'code', label: 'Code', required: true }, { name: 'title', label: 'Title', required: true },
        { name: 'syllabus', label: 'Syllabus', type: 'textarea' }, { name: 'price', label: 'Price', type: 'number', required: true },
        { name: 'is_active', label: 'Active (visible for applications)', type: 'checkbox' },
      ]} />
  );
}

export function Batches() {
  const { profile } = useAuth();
  const mine = profile.role === 'instructor';
  return (
    <DataPage title={mine ? 'My batches' : 'Batches'} subtitle={mine ? 'Batches assigned to you.' : 'Active and upcoming batches, instructors and rooms.'}
      endpoint="/api/batches" searchPlaceholder="Search by batch name"
      canCreate={isStaff(profile)} canEdit={isStaff(profile)} canDelete={profile.role === 'admin'} createLabel="Add batch"
      filters={mine ? [] : [
        { param: 'course_id', label: 'Course', type: 'select', optionsFrom: { endpoint: '/api/courses', label: 'title' } },
        { param: 'startsAfter', label: 'Starts on or after', type: 'date' },
      ]}
      columns={[
        { label: 'Batch', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
        { label: 'Course', render: (r) => r.course?.title ?? '—' },
        { label: 'Dates', render: (r) => `${fmtDate(r.starts_on)} to ${fmtDate(r.ends_on)}` },
        { label: 'Instructor', render: (r) => r.instructor?.full_name ?? 'Unassigned' },
        { label: 'Room', render: (r) => r.asset?.name ?? '—' }, { label: 'Seats', key: 'capacity' },
        { label: 'Applications', render: (r) => <Badge value={r.is_open ? 'active' : 'inactive'} label={r.is_open ? 'Open' : 'Closed'} /> },
      ]}
      fields={[
        { name: 'name', label: 'Batch name', required: true },
        { name: 'course_id', label: 'Course', type: 'select', required: true, optionsFrom: { endpoint: '/api/courses', label: 'title' } },
        { name: 'instructor_id', label: 'Instructor', type: 'select', optionsFrom: { endpoint: '/api/instructors', label: 'full_name' } },
        { name: 'asset_id', label: 'Classroom / lab', type: 'select', optionsFrom: { endpoint: '/api/assets', label: 'name' } },
        { name: 'starts_on', label: 'Starts on', type: 'date', required: true }, { name: 'ends_on', label: 'Ends on', type: 'date', required: true },
        { name: 'capacity', label: 'Capacity', type: 'number', required: true },
        { name: 'is_open', label: 'Open for applications', type: 'checkbox' },
      ]} />
  );
}

export function Assets() {
  const { profile } = useAuth();
  return (
    <DataPage title="Rooms and labs" subtitle="Classroom and lab allocations. Double-booking is blocked by the database."
      endpoint="/api/assets" searchPlaceholder="Search by name" canCreate canEdit canDelete={profile.role === 'admin'} createLabel="Add room or lab"
      filters={[{ param: 'kind', label: 'Type', type: 'pills', options: [{ value: '', label: 'All' }, { value: 'classroom', label: 'Classrooms' }, { value: 'lab', label: 'Labs' }] }]}
      columns={[
        { label: 'Name', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
        { label: 'Type', render: (r) => <span className="capitalize">{r.kind}</span> }, { label: 'Capacity', key: 'capacity' },
        { label: 'Location', key: 'location' }, { label: 'Status', render: (r) => <Badge value={r.is_active ? 'active' : 'inactive'} /> },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'kind', label: 'Type', type: 'select', required: true, options: [{ value: 'classroom', label: 'Classroom' }, { value: 'lab', label: 'Lab' }] },
        { name: 'capacity', label: 'Capacity', type: 'number', required: true }, { name: 'location', label: 'Location' },
        { name: 'is_active', label: 'In service', type: 'checkbox' },
      ]} />
  );
}

export function Students() {
  const flat = (r) => ({ full_name: r.full_name, phone: r.phone, ...(Array.isArray(r.details) ? r.details[0] : r.details) });
  return (
    <DataPage title="Students" subtitle="Demographics, contact details and learning pathways. Students register themselves."
      endpoint="/api/students" updateMethod="put" canEdit rowToForm={(r) => ({ ...flat(r), id: r.id })}
      searchPlaceholder="Search by name"
      filters={[{ param: 'pathway', label: 'Learning pathway contains', type: 'text' }]}
      columns={[
        { label: 'Name', render: (r) => <span className="font-medium text-slate-900">{r.full_name}</span> },
        { label: 'Email', key: 'email' }, { label: 'Phone', key: 'phone' },
        { label: 'Pathway', render: (r) => flat(r).learning_pathway ?? '—' },
        { label: 'Guardian', render: (r) => flat(r).guardian_name ?? '—' },
        { label: 'Joined', render: (r) => fmtDate(r.created_at) },
      ]}
      fields={[
        { name: 'full_name', label: 'Full name', required: true }, { name: 'phone', label: 'Phone' },
        { name: 'date_of_birth', label: 'Date of birth', type: 'date' }, { name: 'address', label: 'Address', type: 'textarea' },
        { name: 'guardian_name', label: 'Guardian name' }, { name: 'guardian_phone', label: 'Guardian phone' },
        { name: 'learning_pathway', label: 'Learning pathway' },
      ]} />
  );
}

export function Instructors() {
  return (
    <DataPage title="Instructors" subtitle="Workload across batches. To add an instructor, promote a user on the Users page."
      endpoint="/api/instructors" searchable={false}
      columns={[
        { label: 'Name', render: (r) => <span className="font-medium text-slate-900">{r.full_name}</span> }, { label: 'Email', key: 'email' },
        { label: 'Batches', key: 'batches' }, { label: 'Students', key: 'students' }, { label: 'Next batch starts', render: (r) => fmtDate(r.next_start) },
      ]} />
  );
}

export function Users() {
  return (
    <DataPage title="Users and roles" subtitle="Everyone starts as a student. Promote staff and instructors here."
      endpoint="/api/admin/users" canEdit searchPlaceholder="Search by name"
      filters={[{ param: 'role', label: 'Role', type: 'pills', options: [{ value: '', label: 'All' }, { value: 'admin', label: 'Admin' }, { value: 'staff', label: 'Staff' }, { value: 'instructor', label: 'Instructors' }, { value: 'student', label: 'Students' }] }]}
      columns={[
        { label: 'Name', render: (r) => <span className="font-medium text-slate-900">{r.full_name}</span> }, { label: 'Email', key: 'email' },
        { label: 'Role', render: (r) => <span className="capitalize">{r.role}</span> }, { label: 'Status', render: (r) => <Badge value={r.is_active ? 'active' : 'inactive'} /> },
      ]}
      fields={[
        { name: 'role', label: 'Role', type: 'select', required: true, options: ['admin', 'staff', 'instructor', 'student'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
        { name: 'is_active', label: 'Account active', type: 'checkbox' },
      ]} />
  );
}

export function AuditLog() {
  return (
    <DataPage title="System logs" subtitle="Who changed what, newest first." endpoint="/api/admin/logs" searchable={false} pageSize={30}
      columns={[
        { label: 'When', render: (r) => fmtDateTime(r.created_at) }, { label: 'Action', key: 'action' }, { label: 'Entity', key: 'entity' },
        { label: 'Actor', render: (r) => <code className="text-xs">{r.actor_id?.slice(0, 8) ?? '—'}</code> },
        { label: 'Detail', render: (r) => <code className="text-xs">{r.detail ? JSON.stringify(r.detail) : '—'}</code> },
      ]} />
  );
}