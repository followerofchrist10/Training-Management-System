import express from 'express';
import { helmetMw, corsMw, globalLimiter } from './middleware/security.js';
import { notFound, errorHandler } from './middleware/errors.js';
import applications from './routes/applications.routes.js';

const app = express();
app.set('trust proxy', 1);              // set to your real proxy hop count so req.ip is the client, not the LB
app.disable('x-powered-by');

app.use(helmetMw);
app.use(corsMw);
app.use(globalLimiter);
app.use(express.json({ limit: '20kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/applications', applications);

app.use(notFound);
app.use(errorHandler);
export default app;