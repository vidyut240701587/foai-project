import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import { plannerService } from '../services/plannerService.js';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

const planSchema = z.object({
  subject: z.string(),
  availableDays: z.number().int().min(1).max(90),
  dailyHours: z.number().min(1).max(12),
  topics: z.array(z.string()).min(1),
  examDate: z.coerce.date().optional(),
});

const generatePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload' },
      });
    }

    const user = (req as AuthenticatedRequest).user;
    const localSubject = await prisma.subject.findFirst({
      where: { OR: [{ id: parsed.data.subject }, { name: { equals: parsed.data.subject, mode: 'insensitive' } }] },
      include: { units: { include: { topics: true } } },
    });
    const topicFrequencies = Object.fromEntries(
      (localSubject?.units.flatMap((unit) => unit.topics) ?? []).map((topic) => [topic.name, topic.questionFrequency ?? 0]),
    );
    const plan = plannerService.generatePlan({ ...parsed.data, topicFrequencies });
    const record = await prisma.studyPlan.create({
      data: {
        userId: user.id,
        title: `${parsed.data.subject} study plan`,
        examDate: parsed.data.examDate,
        days: { create: plan.days.map((day) => ({ dayIndex: day.dayIndex, title: day.title, summary: day.summary })) },
        tasks: {
          create: plan.days.flatMap((day) => day.tasks.map((task) => ({
            title: `${parsed.data.subject}: ${task.topic}`,
            description: `Study ${task.topic} for ${task.durationMinutes} minutes.`,
            subjectName: parsed.data.subject,
            topicName: task.topic,
            durationMinutes: task.durationMinutes,
            scheduledAt: task.scheduledAt,
            priority: task.priority,
            status: 'pending',
          }))),
        },
      },
      include: { days: true, tasks: { orderBy: { scheduledAt: 'asc' } } },
    });
    return res.status(201).json({ success: true, data: record });
  } catch (error) {
    return next(error);
  }
};

router.post(['/', '/generate'], generatePlan);

router.get('/', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const plans = await prisma.studyPlan.findMany({
      where: { userId: user.id },
      include: { days: { orderBy: { dayIndex: 'asc' } }, tasks: { orderBy: { scheduledAt: 'asc' } } },
      orderBy: { generatedAt: 'desc' },
      take: 10,
    });
    res.json({ success: true, data: { plans, current: plans[0] ?? null } });
  } catch (error) {
    next(error);
  }
});

router.post('/tasks', async (req, res, next) => {
  try {
    const parsed = z.object({
      subject: z.string().min(1),
      topic: z.string().min(1),
      durationMinutes: z.number().int().min(5).max(480).default(30),
      scheduledAt: z.coerce.date().optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw new AppError('A subject and topic are required to add a study task.', 'VALIDATION_ERROR', 400);
    const user = (req as AuthenticatedRequest).user;
    const plan = await prisma.studyPlan.findFirst({ where: { userId: user.id, status: 'active' }, orderBy: { generatedAt: 'desc' } });
    const taskData = {
      title: `${parsed.data.subject}: ${parsed.data.topic}`,
      description: `Study ${parsed.data.topic} for ${parsed.data.durationMinutes} minutes.`,
      subjectName: parsed.data.subject,
      topicName: parsed.data.topic,
      durationMinutes: parsed.data.durationMinutes,
      scheduledAt: parsed.data.scheduledAt ?? new Date(),
      priority: 1,
      status: 'pending',
    };
    const task = plan
      ? await prisma.studyTask.create({ data: { ...taskData, studyPlanId: plan.id } })
      : (await prisma.studyPlan.create({ data: { userId: user.id, title: `${parsed.data.subject} study plan`, tasks: { create: taskData } }, include: { tasks: true } })).tasks[0];
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

router.patch('/tasks/:id', async (req, res, next) => {
  try {
    const parsed = z.object({ action: z.enum(['complete', 'skip', 'reschedule']), scheduledAt: z.coerce.date().optional() }).safeParse(req.body);
    if (!parsed.success) throw new AppError('Choose complete, skip, or provide a new scheduled date.', 'VALIDATION_ERROR', 400);
    const user = (req as unknown as AuthenticatedRequest).user;
    const task = await prisma.studyTask.findFirst({ where: { id: req.params.id, studyPlan: { userId: user.id } } });
    if (!task) throw new AppError('Study task not found.', 'NOT_FOUND', 404);
    if (parsed.data.action === 'reschedule' && !parsed.data.scheduledAt) throw new AppError('A new date is required to reschedule this task.', 'VALIDATION_ERROR', 400);
    const updated = await prisma.studyTask.update({
      where: { id: task.id },
      data: parsed.data.action === 'complete'
        ? { completed: true, status: 'completed' }
        : parsed.data.action === 'skip'
          ? { completed: false, status: 'skipped' }
          : { scheduledAt: parsed.data.scheduledAt, status: 'pending' },
    });
    if (parsed.data.action === 'complete' && task.topicName && task.subjectName) {
      const topic = await prisma.topic.findFirst({
        where: { name: { equals: task.topicName, mode: 'insensitive' }, unit: { subject: { name: { equals: task.subjectName, mode: 'insensitive' } } } },
      });
      if (topic) {
        await prisma.topicProgress.upsert({
          where: { userId_topicId: { userId: user.id, topicId: topic.id } },
          create: { userId: user.id, topicId: topic.id, completed: true, mastery: 1, lastStudied: new Date() },
          update: { completed: true, mastery: 1, lastStudied: new Date() },
        });
      }
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/tasks/:id', async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const task = await prisma.studyTask.findFirst({ where: { id: req.params.id, studyPlan: { userId: user.id } } });
    if (!task) throw new AppError('Study task not found.', 'NOT_FOUND', 404);
    await prisma.studyTask.delete({ where: { id: task.id } });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

router.post('/replan', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const plan = await prisma.studyPlan.findFirst({
      where: { userId: user.id, status: 'active' },
      include: { tasks: { where: { status: 'pending' }, orderBy: { scheduledAt: 'asc' } } },
      orderBy: { generatedAt: 'desc' },
    });
    if (!plan) throw new AppError('Create a study plan before replanning.', 'NOT_FOUND', 404);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const updates = plan.tasks.map((task, index) => {
      const day = new Date(start.getTime() + Math.floor(index / 4) * 86400000);
      return prisma.studyTask.update({ where: { id: task.id }, data: { scheduledAt: day } });
    });
    const tasks = await prisma.$transaction(updates);
    res.json({ success: true, data: { planId: plan.id, tasks } });
  } catch (error) {
    next(error);
  }
});

export { router as plannerRouter };
