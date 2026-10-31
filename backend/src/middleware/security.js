import helmet from 'helmet';
import cors from 'cors';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (origins.includes('*')) throw new Error('Wildcard CORS origin is not allowed');

export const helmetMw = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],          // this is a JSON API: nothing should load from it
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
});

export const corsMw = cors({
  origin(origin, cb) {
    if (!origin) return cb(null, false);            // non-browser clients: no CORS headers
    return cb(null, origins.includes(origin));      // exact match only
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  maxAge: 600,
});

const base = { standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' } };

// Blanket limit by IP (runs before auth, so it also blunts token-guessing).
export const globalLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 300 });

// Writes are limited per authenticated user (falls back to IP).
export const writeLimiter = rateLimit({
  ...base, windowMs: 60 * 1000, limit: 20,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
});

// Status transitions: tighter, since each one fires side effects (invoice, notification).
export const transitionLimiter = rateLimit({
  ...base, windowMs: 60 * 1000, limit: 30,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
});