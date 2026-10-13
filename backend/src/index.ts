import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.js';
import prisma from './lib/prisma.js';
import { aiRouter } from './routes/ai.js';
import { analysisRouter } from './routes/analysis.js';
import { authRouter } from './routes/auth.js';
import { notesRouter } from './routes/notes.js';
import { plannerRouter } from './routes/planner.js';
import { progressRouter } from './routes/progress.js';
import { questionPapersRouter } from './routes/questionPapers.js';
import { quizRouter } from './routes/quiz.js';
import { subjectsRouter } from './routes/subjects.js';
import { createErrorResponse } from './utils/errors.js';
import { aiService } from './services/aiService.js';
import { officialSyllabusRouter } from './routes/officialSyllabus.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');

const getDbHealth = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected' };
  } catch (error) {
    console.error('Database health check failed', error);
    return {
      status: 'error',
      database: 'disconnected',
    };
  }
};

const getAiHealth = () => ({
  status: env.geminiApiKey ? 'configured' : 'not_configured',
  provider: 'Google Gemini',
  configured: Boolean(env.geminiApiKey),
  model: env.geminiModel,
});

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const isDevelopmentOrigin = env.nodeEnv !== 'production'
        && typeof origin === 'string'
        && /^https?:\/\/(localhost|127\.0\.0\.1):(\d+)$/.test(origin);

      if (!origin || origin === env.frontendUrl || isDevelopmentOrigin) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/', (_req, res) => {
  res.json({
    success: true,
    app: 'Smart Exam Planner API',
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    apiBase: '/api',
  });
});

app.get('/api/health', async (_req, res) => {
  const [db, ai] = await Promise.all([getDbHealth(), Promise.resolve(getAiHealth())]);

  const healthy = db.status === 'ok';
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: db,
      gemini: ai,
      ai,
    },
  });
});

app.get('/api/health/db', async (_req, res) => {
  const result = await getDbHealth();
  res.status(result.status === 'ok' ? 200 : 503).json({
    success: result.status === 'ok',
    ...result,
  });
});

app.get('/api/health/ai', async (_req, res) => {
  const result = getAiHealth();
  if (!result.configured) {
    res.status(503).json({ success: false, error: 'AI service is not configured', ...result });
    return;
  }
  try {
    await aiService.healthCheck();
    res.json({ success: true, provider: 'Google Gemini', configured: true, model: env.geminiModel, status: 'healthy' });
  } catch (error) {
    const failure = error && typeof error === 'object' && 'details' in error
      ? (error as { details?: Record<string, unknown> }).details
      : undefined;
    const message = error instanceof Error ? error.message : 'Gemini API request failed';
    res.status(503).json({
      success: false,
      provider: 'Google Gemini',
      configured: true,
      model: env.geminiModel,
      status: 'unhealthy',
      error: message,
      ...(failure ? { details: failure } : {}),
    });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/notes', notesRouter);
app.use('/api/question-papers', questionPapersRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/planner', plannerRouter);
app.use('/api/ai', aiRouter);
app.use('/api/progress', progressRouter);
app.use('/api/academic', officialSyllabusRouter);

if (env.nodeEnv === 'production') {
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  app.use(express.static(frontendDistPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
});

app.use(
  (
    err: Error & { statusCode?: number; code?: string; details?: Record<string, unknown> },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const statusCode = err.statusCode || 500;
    const code = err.code || 'INTERNAL_SERVER_ERROR';
    const isInternalError = statusCode >= 500;
    if (isInternalError) console.error('API request failed', { code, statusCode, error: err });
    const message = env.nodeEnv === 'production' && isInternalError ? 'Internal server error' : err.message || 'Something went wrong';

    if (code === 'AI_NOT_CONFIGURED') {
      res.status(503).json({ success: false, error: { code, message: 'AI service is not configured' } });
      return;
    }
    res.status(statusCode).json(createErrorResponse(code, message, env.nodeEnv === 'production' && isInternalError ? undefined : err.details));
  }
);

if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`Gemini configured: ${Boolean(env.geminiApiKey)}`);
    console.log(`Smart Exam Planner API running on port ${env.port} (${env.nodeEnv})`);
  });
}

export default app;
