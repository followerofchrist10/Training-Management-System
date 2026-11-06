import express from 'express';
import { helmetMw, corsMw, globalLimiter } from './middleware/security.js';
import { notFound, errorHandler } from './middleware/errors.js';
import applications from './routes/applications.routes.js';
import { me, catalog, dashboard, notifications, invoices, attendance, reports } from './routes/ops.routes.js';
import { students, instructors, admin } from './routes/people.routes.js';
import { courses, batches, assets, grades } from './routes/resources.routes.js';

const app = express();
app.set('trust proxy', 1);              // set to your real proxy hop count so req.ip is the client, not the LB
app.disable('x-powered-by');

app.use(helmetMw);
app.use(corsMw);
app.use(globalLimiter);
app.use(express.json({ limit: '20kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/me', me);
app.use('/api', catalog);
app.use('/api/dashboard', dashboard);
app.use('/api/notifications', notifications);
app.use('/api/invoices', invoices);
app.use('/api/attendance', attendance);
app.use('/api/reports', reports);
app.use('/api/applications', applications);
app.use('/api/students', students);
app.use('/api/instructors', instructors);
app.use('/api/admin', admin);
app.use('/api/courses', courses);
app.use('/api/batches', batches);
app.use('/api/assets', assets);
app.use('/api/grades', grades);

app.use(notFound);
app.use(errorHandler);
export default app;