import { Router } from 'express';
import { z } from 'zod';

import prisma from '../lib/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

const getProgressSummary = (subject: {
  id: string;
  code: string;
  name: string;
  department?: { name: string } | null;
  semester?: { name: string } | null;
  units: Array<{ name: string; topics: Array<{ id: string; name: string; questionFrequency: number | null; importanceScore: number | null; progress: Array<{ completed: boolean }> }> }>;
  questionPapers: unknown[];
  exams: Array<{ examDate: Date }>;
}, profile: { department: string | null; semester: string | null } | null) => {
  const topics = subject.units.flatMap((unit) => unit.topics);
  const completed = topics.filter((topic) => topic.progress.some((entry) => entry.completed)).length;
  return {
    id: subject.id,
    code: subject.code,
    name: subject.name,
    department: subject.department?.name ?? profile?.department ?? '—',
    semester: subject.semester?.name ?? profile?.semester ?? '—',
    completion: topics.length ? Math.round((completed / topics.length) * 100) : 0,
    importantTopics: topics
      .filter((topic) => (topic.importanceScore ?? 0) > 0)
      .sort((left, right) => (right.importanceScore ?? 0) - (left.importanceScore ?? 0))
      .slice(0, 5)
      .map((topic) => topic.name),
    syllabus: subject.units.map((unit) => ({
      unit: unit.name,
      topics: unit.topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        completed: topic.progress.some((entry) => entry.completed),
        questionFrequency: topic.questionFrequency ?? 0,
      })),
    })),
    questionPapers: subject.questionPapers,
    examDate: subject.exams[0]?.examDate.toISOString(),
  };
};

const subjectIncludes = (userId: string) => ({
  department: true,
  semester: true,
  units: { include: { topics: { include: { progress: { where: { userId } } } } } },
  questionPapers: true,
  exams: { where: { userId }, select: { examDate: true }, orderBy: { examDate: 'asc' as const } },
});

router.get('/', async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const [userSubjects, profile, locallyImportedSubjects] = await Promise.all([
      prisma.userSubject.findMany({ where: { userId: user.id }, include: { subject: { include: subjectIncludes(user.id) } } }),
      prisma.profile.findUnique({ where: { userId: user.id }, select: { department: true, semester: true } }),
      prisma.subject.findMany({
        where: { externalId: { not: null } },
        include: subjectIncludes(user.id),
      }),
    ]);

    const subjects = [
      ...locallyImportedSubjects.map((subject) => getProgressSummary(subject, profile)),
      ...userSubjects.map(({ subject }) => getProgressSummary(subject, profile)),
    ];
    const uniqueSubjects = [...new Map(subjects.map((subject) => [subject.id, subject])).values()];
    res.json({ success: true, data: { subjects: uniqueSubjects } });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const [profile, subject] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: user.id }, select: { department: true, semester: true } }),
      prisma.subject.findFirst({
        where: { OR: [
          { externalId: req.params.id },
          { id: req.params.id, userSubjects: { some: { userId: user.id } } },
        ] },
        include: {
          ...subjectIncludes(user.id),
          notes: true,
          questionPapers: { include: { questions: true } },
        },
      }),
    ]);
    if (!subject) throw new AppError('Subject not found.', 'NOT_FOUND', 404);
    res.json({ success: true, data: { ...getProgressSummary(subject, profile), notes: subject.notes } });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/syllabus', async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const subject = await prisma.subject.findFirst({
      where: { OR: [
        { externalId: req.params.id },
        { id: req.params.id, userSubjects: { some: { userId: user.id } } },
      ] },
      include: { units: { include: { topics: { include: { progress: { where: { userId: user.id } } } } } } },
    });
    if (!subject) throw new AppError('Syllabus not found.', 'NOT_FOUND', 404);
    const syllabus = subject.units.map((unit) => ({
      unit: unit.name,
      topics: unit.topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        completed: topic.progress.some((entry) => entry.completed),
      })),
    }));
    res.json({ success: true, data: syllabus });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/notes', async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const subject = await prisma.subject.findFirst({
      where: { OR: [
        { externalId: req.params.id },
        { id: req.params.id, userSubjects: { some: { userId: user.id } } },
      ] },
      include: { notes: true },
    });
    if (!subject) throw new AppError('Subject not found.', 'NOT_FOUND', 404);
    res.json({ success: true, data: subject.notes });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/question-papers', async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const subject = await prisma.subject.findFirst({
      where: { OR: [
        { externalId: req.params.id },
        { id: req.params.id, userSubjects: { some: { userId: user.id } } },
      ] },
      include: { questionPapers: { include: { questions: true } } },
    });
    if (!subject) throw new AppError('Subject not found.', 'NOT_FOUND', 404);
    res.json({ success: true, data: subject.questionPapers });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/topics/:topicId/progress', async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const parsed = z.object({ completed: z.boolean().default(true) }).safeParse(req.body);
    if (!parsed.success) throw new AppError('Invalid topic progress update.', 'VALIDATION_ERROR', 400);
    const topic = await prisma.topic.findFirst({
      where: {
        id: req.params.topicId,
        unit: { subjectId: req.params.id, subject: { userSubjects: { some: { userId: user.id } } } },
      },
    });
    if (!topic) throw new AppError('Topic not found.', 'NOT_FOUND', 404);
    const progress = await prisma.topicProgress.upsert({
      where: { userId_topicId: { userId: user.id, topicId: topic.id } },
      create: { userId: user.id, topicId: topic.id, completed: parsed.data.completed, mastery: parsed.data.completed ? 1 : 0, lastStudied: new Date() },
      update: { completed: parsed.data.completed, mastery: parsed.data.completed ? 1 : 0, lastStudied: new Date() },
    });
    res.json({ success: true, data: progress });
  } catch (error) {
    next(error);
  }
});

export { router as subjectsRouter };