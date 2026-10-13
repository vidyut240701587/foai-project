import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { AuthenticatedRequest, requireAuth } from './auth.js';
import { AppError } from '../utils/errors.js';

export function requireAcademicAdmin(req: Request, res: Response, next: NextFunction) {
  void requireAuth(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }
    const user = (req as AuthenticatedRequest).user;
    if (!env.academicAdminEmails.includes(user.email.toLowerCase())) {
      next(new AppError('Academic import access is not enabled for this account.', 'FORBIDDEN', 403));
      return;
    }
    next();
  });
}