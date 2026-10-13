import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import prisma from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';

export type AuthenticatedRequest = Request & {
  user: NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;
};

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) {
    next(new AppError('Authentication required', 'UNAUTHORIZED', 401));
    return;
  }

  let userId: string;
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new Error('Invalid token payload');
    }
    userId = payload.sub;
  } catch {
    next(new AppError('Your session has expired. Please sign in again.', 'UNAUTHORIZED', 401));
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      next(new AppError('Your account could not be found. Please sign in again.', 'UNAUTHORIZED', 401));
      return;
    }
    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    next(error);
  }
}