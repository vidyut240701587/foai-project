import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

router.post('/', async (req, res, next) => {
  try {
    const parsed = z.object({ topicId: z.string().min(1), completed: z.boolean().default(true), mastery: z.number().min(0).max(1).optional() }).safeParse(req.body);
    if (!parsed.success) throw new AppError('A valid topic progress update is required.', 'VALIDATION_ERROR', 400);
    const user = (req as AuthenticatedRequest).user;
    const topic = await prisma.topic.findFirst({
      where: { id: parsed.data.topicId, unit: { subject: { userSubjects: { some: { userId: user.id } } } } },
    });
    if (!topic) throw new AppError('Topic not found in your subjects.', 'NOT_FOUND', 404);
    const mastery = parsed.data.mastery ?? (parsed.data.completed ? 1 : 0);
    const progress = await prisma.topicProgress.upsert({
      where: { userId_topicId: { userId: user.id, topicId: topic.id } },
      create: { userId: user.id, topicId: topic.id, completed: parsed.data.completed, mastery, lastStudied: new Date() },
      update: { completed: parsed.data.completed, mastery, lastStudied: new Date() },
    });
    res.status(201).json({ success: true, data: progress });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const [profile, attempts, topicProgress, plan] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: user.id }, select: { selectedSubjects: true } }),
      prisma.quizAttempt.findMany({ where: { userId: user.id }, include: { quiz: { select: { title: true, subjectId: true } } }, orderBy: { submittedAt: 'desc' } }),
      prisma.topicProgress.findMany({ where: { userId: user.id }, include: { topic: { include: { unit: { include: { subject: true } } } } } }),
      prisma.studyPlan.findFirst({ where: { userId: user.id, status: 'active' }, include: { tasks: true }, orderBy: { generatedAt: 'desc' } }),
    ]);
    const selectedSubjects = Array.isArray(profile?.selectedSubjects) ? profile.selectedSubjects.filter((name): name is string => typeof name === 'string') : [];
    const subjects = selectedSubjects.length
      ? await prisma.subject.findMany({
          where: { name: { in: selectedSubjects } },
          include: {
            units: {
              include: {
                topics: {
                  include: { progress: { where: { userId: user.id } } },
                },
              },
            },
          },
        })
      : [];
    const subjectCompletion = subjects.map((subject) => {
      const topics = subject.units.flatMap((unit) => unit.topics);
      const completedTopics = topics.filter((topic) => topic.progress.some((item) => item.completed)).length;
      return { subjectId: subject.id, subject: subject.name, totalTopics: topics.length, completedTopics, completion: topics.length ? Math.round((completedTopics / topics.length) * 100) : 0 };
    });
    const totalTopics = subjectCompletion.reduce((total, item) => total + item.totalTopics, 0);
    const completedTopics = subjectCompletion.reduce((total, item) => total + item.completedTopics, 0);
    const quizTotal = attempts.reduce((total, item) => total + item.total, 0);
    const quizScore = attempts.reduce((total, item) => total + item.score, 0);
    const activity = [
      ...attempts.map((attempt) => ({ type: 'quiz', date: attempt.submittedAt, title: attempt.quiz.title })),
      ...topicProgress.filter((item) => item.lastStudied).map((item) => ({ type: 'study', date: item.lastStudied as Date, title: item.topic.name })),
    ].sort((left, right) => right.date.getTime() - left.date.getTime()).slice(0, 30);

    res.json({
      success: true,
      data: {
        overallCompletion: totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0,
        totalTopics,
        completedTopics,
        subjectCompletion,
        quizAccuracy: quizTotal ? Math.round((quizScore / quizTotal) * 100) : 0,
        quizAttempts: attempts.length,
        weakTopics: topicProgress.filter((item) => item.mastery < 0.6).map((item) => ({ topic: item.topic.name, subject: item.topic.unit?.subject.name ?? 'Unassigned', mastery: item.mastery })),
        studyPlan: plan,
        activity,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:subjectId', async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const subject = await prisma.subject.findUnique({
      where: { id: req.params.subjectId },
      include: {
        units: {
          include: {
            topics: {
              include: { progress: { where: { userId: user.id } } },
            },
          },
        },
      },
    });
    if (!subject) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Subject not found.' } });
    const topics = subject.units.flatMap((unit) => unit.topics);
    const completed = topics.filter((topic) => topic.progress.some((item) => item.completed)).length;
    return res.json({ success: true, data: { subjectId: subject.id, completion: topics.length ? Math.round((completed / topics.length) * 100) : 0, totalTopics: topics.length, topicsCompleted: completed } });
  } catch (error) {
    return next(error);
  }
});

export { router as progressRouter };
