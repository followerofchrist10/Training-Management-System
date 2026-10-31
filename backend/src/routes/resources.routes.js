import { crudRouter } from '../controllers/crud.js';

const STAFF = ['staff', 'admin'];

export const courses = crudRouter({
  table: 'courses', searchCol: 'title', filters: ['is_active'], gte: { minPrice: 'price' },
  order: { col: 'title', asc: true }, writeRoles: STAFF, deleteRoles: ['admin'],
  schema: {
    code:      { type: 'string', required: true, max: 20 },
    title:     { type: 'string', required: true, max: 120 },
    syllabus:  { type: 'string', max: 5000, nullable: true },
    price:     { type: 'number', required: true, max: 1_000_000 },
    is_active: { type: 'bool' },
  },
});

export const batches = crudRouter({
  table: 'batches', searchCol: 'name', filters: ['course_id', 'instructor_id', 'is_open'], gte: { startsAfter: 'starts_on' },
  select: `id, name, starts_on, ends_on, capacity, is_open, course_id, instructor_id, asset_id,
           course:courses(id, title, code), instructor:profiles!batches_instructor_id_fkey(id, full_name), asset:assets(id, name)`,
  order: { col: 'starts_on', asc: false }, writeRoles: STAFF, deleteRoles: ['admin'],
  schema: {
    course_id:     { type: 'uuid', required: true },
    instructor_id: { type: 'uuid', nullable: true },
    asset_id:      { type: 'uuid', nullable: true },
    name:          { type: 'string', required: true, max: 80 },
    starts_on:     { type: 'date', required: true },
    ends_on:       { type: 'date', required: true },
    capacity:      { type: 'int', required: true, min: 1, max: 500 },
    is_open:       { type: 'bool' },
  },
});

export const assets = crudRouter({
  table: 'assets', searchCol: 'name', filters: ['kind', 'is_active'],
  order: { col: 'name', asc: true }, writeRoles: STAFF, deleteRoles: ['admin'],
  schema: {
    name:      { type: 'string', required: true, max: 80 },
    kind:      { type: 'enum', required: true, values: ['classroom', 'lab'] },
    capacity:  { type: 'int', required: true, min: 1, max: 1000 },
    location:  { type: 'string', max: 120, nullable: true },
    is_active: { type: 'bool' },
  },
});

export const grades = crudRouter({
  table: 'grades', filters: ['batch_id', 'student_id'],
  select: 'id, batch_id, student_id, assessment, score, max_score, graded_at, student:profiles!grades_student_id_fkey(full_name), batch:batches(name)',
  order: { col: 'graded_at', asc: false }, writeRoles: ['instructor'], deleteRoles: ['instructor'],
  immutable: ['batch_id', 'student_id'],
  inject: (req) => ({ graded_by: req.user.id }),
  schema: {
    batch_id:   { type: 'uuid', required: true },
    student_id: { type: 'uuid', required: true },
    assessment: { type: 'string', required: true, max: 80 },
    score:      { type: 'number', required: true, max: 1000 },
    max_score:  { type: 'number', required: true, min: 1, max: 1000 },
  },
});