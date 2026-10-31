import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter, transitionLimiter } from '../middleware/security.js';
import * as v from '../validators/applications.js';
import * as c from '../controllers/applications.controller.js';

const r = Router();
r.use(authenticate);

r.get('/', v.validateList, c.listApplications);
r.get('/summary', requireRole('staff', 'admin'), c.statusCounts);
r.get('/:id', v.validateId, c.getApplication);

r.post('/', writeLimiter, requireRole('student'), v.validateCreate, c.createApplication);
r.post('/:id/cancel', writeLimiter, requireRole('student'), v.validateId, c.cancelApplication);
r.patch('/:id/status', transitionLimiter, requireRole('staff', 'admin'), v.validateTransition, c.transitionApplication);

export default r;