import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimits.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const authResponse = (user: { id: string; email: string; name: string; onboardingComplete?: boolean }) => ({
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
  },
  token: jwt.sign({ sub: user.id, email: user.email }, env.jwtSecret, { expiresIn: '7d' }),
  onboardingComplete: Boolean(user.onboardingComplete),
});

const safeUser = (user: { id: string; email: string; name: string; passwordHash?: string }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
});

const onboardingSchema = z.object({
  department: z.string().min(1),
  semester: z.string().min(1),
  subjects: z.array(z.string()).min(1),
  examDates: z.array(z.string()).default([]),
  dailyStudyHours: z.number().min(1).max(12).default(4),
  preparationLevel: z.string().min(1),
});
const profileUpdateSchema = z.object({
  department: z.string().min(1),
  semester: z.string().min(1),
  dailyStudyHours: z.number().min(1).max(12),
});

router.post('/register', authRateLimit, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid registration payload', 'VALIDATION_ERROR', 400, parsed.error.flatten().fieldErrors);
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existing) {
      throw new AppError('User already exists', 'USER_EXISTS', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email: normalizedEmail, passwordHash, onboardingComplete: false },
    });

    res.status(201).json({ success: true, data: authResponse(safeUser(user)) });
  } catch (error) {
    next(error);
  }
});

router.post('/login', authRateLimit, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid login payload', 'VALIDATION_ERROR', 400, parsed.error.flatten().fieldErrors);
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      throw new AppError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    res.json({ success: true, data: authResponse(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  res.json({ success: true, data: { user: safeUser(user), onboardingComplete: user.onboardingComplete } });
});

router.post('/logout', (_req, res) => {
  res.json({ success: true, data: { ok: true } });
});

router.post('/forgot-password', (_req, _res, next) => {
  next(new AppError('Password recovery is not configured for this application', 'NOT_CONFIGURED', 501));
});

router.post('/reset-password', (_req, _res, next) => {
  next(new AppError('Password recovery is not configured for this application', 'NOT_CONFIGURED', 501));
});

router.post('/onboarding', requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const parsed = onboardingSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError('Invalid onboarding payload', 'VALIDATION_ERROR', 400, parsed.error.flatten().fieldErrors);
    }

    const profileData = {
      department: parsed.data.department,
      semester: parsed.data.semester,
      preferredHours: parsed.data.dailyStudyHours,
      examDates: parsed.data.examDates,
      selectedSubjects: parsed.data.subjects,
      preparationLevel: parsed.data.preparationLevel,
    };
    const { profile, updatedUser } = await prisma.$transaction(async (transaction) => {
      const profileRecord = await transaction.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...profileData },
        update: profileData,
      });
      const userRecord = await transaction.user.update({
        where: { id: user.id },
        data: {
          departmentId: parsed.data.department,
          semesterId: parsed.data.semester,
          dailyStudyHours: parsed.data.dailyStudyHours,
          onboardingComplete: true,
        },
      });

      for (const subjectName of parsed.data.subjects) {
        const subject = await transaction.subject.findFirst({ where: { name: { equals: subjectName, mode: 'insensitive' } } })
          ?? await transaction.subject.create({
            data: {
              name: subjectName,
              code: subjectName.replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase() || 'CUSTOM',
            },
          });
        await transaction.userSubject.upsert({
          where: { userId_subjectId: { userId: user.id, subjectId: subject.id } },
          create: { userId: user.id, subjectId: subject.id },
          update: {},
        });
      }

      for (const date of parsed.data.examDates) {
        const examDate = new Date(date);
        if (Number.isNaN(examDate.getTime())) continue;
        const existingExam = await transaction.exam.findFirst({ where: { userId: user.id, examDate } });
        const subject = await transaction.userSubject.findFirst({ where: { userId: user.id }, include: { subject: true } });
        if (existingExam) {
          await transaction.exam.update({ where: { id: existingExam.id }, data: { examDate, subjectId: subject?.subjectId } });
        } else {
          await transaction.exam.create({
            data: { userId: user.id, subjectId: subject?.subjectId, title: `${subject?.subject.name ?? 'Study'} exam`, examDate },
          });
        }
      }
      return { profile: profileRecord, updatedUser: userRecord };
    });

    res.json({
      success: true,
      data: {
        user: safeUser(updatedUser),
        profile,
        message: 'Onboarding completed successfully',
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/profile', requireAuth, async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  res.json({ success: true, data: { user: safeUser(user), profile, onboardingComplete: user.onboardingComplete } });
});

router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Invalid profile details.', 'VALIDATION_ERROR', 400, parsed.error.flatten().fieldErrors);
    const user = (req as AuthenticatedRequest).user;
    const profileData = {
      department: parsed.data.department,
      semester: parsed.data.semester,
      preferredHours: parsed.data.dailyStudyHours,
    };
    const [profile, updatedUser] = await prisma.$transaction([
      prisma.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...profileData }, update: profileData }),
      prisma.user.update({ where: { id: user.id }, data: { departmentId: parsed.data.department, semesterId: parsed.data.semester, dailyStudyHours: parsed.data.dailyStudyHours } }),
    ]);
    res.json({ success: true, data: { user: safeUser(updatedUser), profile } });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
