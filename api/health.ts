import type { Request, Response } from 'express';

import { env } from '../backend/src/config/env.js';
import prisma from '../backend/src/lib/prisma.js';

export default async function health(_req: Request, res: Response) {
  let database: { status: 'ok' | 'error'; database: 'connected' | 'disconnected' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { status: 'ok', database: 'connected' };
  } catch (error) {
    console.error('Database health check failed', error);
    database = { status: 'error', database: 'disconnected' };
  }

  const healthy = database.status === 'ok';
  const ai = {
    status: env.geminiApiKey ? 'configured' : 'not_configured',
    provider: 'Google Gemini',
    configured: Boolean(env.geminiApiKey),
    model: env.geminiModel,
  };

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database,
      gemini: ai,
      ai,
    },
  });
}
