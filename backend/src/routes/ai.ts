import { Router } from 'express';
import { z } from 'zod';

import { aiService } from '../services/aiService.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { aiRateLimit } from '../middleware/rateLimits.js';

const router = Router();
router.use(requireAuth);
router.use(aiRateLimit);

const chatSchema = z.object({
  message: z.string().min(1).max(5000),
  mode: z.string().optional(),
  subject: z.string().optional(),
  unit: z.string().optional(),
});

router.post(['/chat', '/assistant'], async (req, res, next) => {
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid chat payload' },
      });
    }

    const user = (req as AuthenticatedRequest).user;
    const [profile, weakTopics, plan, userSubjects, recentQuestionPapers] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: user.id }, select: { department: true, semester: true, selectedSubjects: true } }),
      prisma.topicProgress.findMany({
        where: { userId: user.id, mastery: { lt: 0.6 } },
        include: { topic: { include: { unit: { include: { subject: true } } } } },
        take: 10,
      }),
      prisma.studyPlan.findFirst({
        where: { userId: user.id, status: 'active' },
        include: { tasks: { where: { status: 'pending' }, take: 10 } },
        orderBy: { generatedAt: 'desc' },
      }),
      prisma.userSubject.findMany({
        where: { userId: user.id },
        include: {
          subject: {
            include: {
              units: { include: { topics: { orderBy: { questionFrequency: 'desc' }, take: 20 } } },
              syllabi: { orderBy: { lastSynced: 'desc' }, take: 10 },
            },
          },
        },
      }),
      prisma.questionPaper.findMany({
        where: {
          subjectId: { in: (await prisma.userSubject.findMany({ where: { userId: user.id }, select: { subjectId: true } })).map((entry) => entry.subjectId) },
        },
        include: {
          questions: { include: { questionTopics: { include: { topic: true } } } },
        },
        take: 20,
        orderBy: { year: 'desc' },
      }),
    ]);

    const syllabus = userSubjects.map(({ subject }) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      units: subject.units.map((unit) => ({
        name: unit.name,
        topics: unit.topics.map((topic) => ({ name: topic.name, frequency: topic.questionFrequency ?? 0 })),
      })),
      syllabusSummary: subject.syllabi.map((entry) => ({ title: entry.title ?? entry.unitName ?? 'Syllabus entry', content: entry.content.slice(0, 420) })),
    }));

    const questionPaperSummary = recentQuestionPapers.map((paper) => ({
      title: paper.title,
      year: paper.year,
      examType: paper.examType,
      topics: paper.questions.flatMap((question) => question.questionTopics.map((entry) => entry.topic.name)),
    }));

    const fallbackSubject = profile?.selectedSubjects && Array.isArray(profile.selectedSubjects) ? profile.selectedSubjects[0] : undefined;

    const context = {
      student: { name: user.name, department: profile?.department, semester: profile?.semester, subjects: profile?.selectedSubjects },
      weakTopics: weakTopics.map(({ topic }) => ({ topic: topic.name, subject: topic.unit?.subject.name })),
      upcomingTasks: plan?.tasks.map((task) => ({ title: task.title, date: task.scheduledAt })),
      syllabus,
      questionPaperContext: questionPaperSummary,
    };
    const response = await aiService.answerChat(parsed.data.message, {
      mode: parsed.data.mode,
      subject: parsed.data.subject ?? (fallbackSubject ? String(fallbackSubject) : undefined),
      unit: parsed.data.unit,
      context: JSON.stringify(context),
    });
    await prisma.chatMessage.createMany({
      data: [
        { userId: user.id, role: 'user', content: parsed.data.message },
        { userId: user.id, role: 'assistant', content: response.answer },
      ],
    });
    return res.json({ success: true, data: response });
  } catch (error) {
    return next(error);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const messages = await prisma.chatMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' }, take: 100 });
    res.json({ success: true, data: { messages } });
  } catch (error) {
    next(error);
  }
});

router.post('/study-plan', async (req, res, next) => {
  try {
    const parsed = z.object({ subject: z.string().min(1), examDate: z.string().min(1), availableHours: z.number().min(1).max(12), priorityTopics: z.array(z.string().min(1)).min(1) }).safeParse(req.body);
    if (!parsed.success) throw new AppError('Subject, exam date, available hours, and local syllabus topics are required.', 'VALIDATION_ERROR', 400);
    const user = (req as AuthenticatedRequest).user;
    const subject = await prisma.subject.findFirst({
      where: { OR: [
        { id: parsed.data.subject, externalId: { not: null } },
        { externalId: parsed.data.subject },
        { id: parsed.data.subject, userSubjects: { some: { userId: user.id } } },
        { name: { equals: parsed.data.subject, mode: 'insensitive' }, userSubjects: { some: { userId: user.id } } },
      ] },
      include: { units: { include: { topics: true } } },
    });
    if (!subject) throw new AppError('Select a subject available in your local academic database.', 'NOT_FOUND', 404);
    const syllabusTopics = subject.units.flatMap((unit) => unit.topics);
    const localTopicNames = new Set(syllabusTopics.map((topic) => topic.name.toLowerCase()));
    const priorityTopics = parsed.data.priorityTopics.map((topic) => topic.trim());
    if (priorityTopics.some((topic) => !localTopicNames.has(topic.toLowerCase()))) {
      throw new AppError('Study-plan topics must belong to the selected local syllabus.', 'VALIDATION_ERROR', 400);
    }
    const topicFrequencies = Object.fromEntries(syllabusTopics.map((topic) => [topic.name, topic.questionFrequency ?? 0]));
    const generated = await aiService.generateStudyPlan({
      subject: subject.name,
      examDate: parsed.data.examDate,
      availableHours: parsed.data.availableHours,
      priorityTopics,
      topicFrequencies,
    });
    const generatedDays = generated.days?.map((day) => ({ ...day, tasks: day.tasks ?? [] })) ?? [];
    if (!generatedDays.length || generatedDays.some((day) => !day.tasks.length)) {
      throw new AppError('The AI service returned an invalid study plan. Please retry.', 'AI_INVALID_RESPONSE', 502);
    }
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const record = await prisma.studyPlan.create({
      data: {
        userId: user.id,
        title: `${subject.name} AI study plan`,
        examDate: new Date(parsed.data.examDate),
        days: { create: generatedDays.map((day, index) => ({ dayIndex: index + 1, title: String(day.title ?? `Study day ${index + 1}`), summary: day.tasks.map((task) => String(task.topic)).join(', ') })) },
        tasks: {
          create: generatedDays.flatMap((day, dayIndex) => day.tasks.map((task) => {
            const topicName = String(task.topic);
            const durationMinutes = Number(task.durationMinutes);
            const priority = Number(task.priority);
            const scheduledAt = new Date(startDate.getTime() + dayIndex * 86400000);
            return {
              title: `${subject.name}: ${topicName}`,
              description: `AI study recommendation: review ${topicName}.`,
              subjectName: subject.name,
              topicName,
              durationMinutes: Number.isInteger(durationMinutes) && durationMinutes > 0 ? Math.min(durationMinutes, parsed.data.availableHours * 60) : Math.floor(parsed.data.availableHours * 60 / day.tasks.length),
              priority: [1, 2, 3].includes(priority) ? priority : 2,
              scheduledAt,
              status: 'pending',
            };
          })),
        },
      },
      include: { days: { orderBy: { dayIndex: 'asc' } }, tasks: { orderBy: { scheduledAt: 'asc' } } },
    });
    res.status(201).json({ success: true, data: { ...record, recommendationDisclaimer: 'AI-generated study recommendation; not a guarantee of exam questions.' } });
  } catch (error) {
    next(error);
  }
});

router.post('/predict-topics', async (req, res, next) => {
  try {
    const parsed = z.object({ questionPapers: z.array(z.unknown()).min(1) }).safeParse(req.body);
    if (!parsed.success) throw new AppError('Provide real question-paper data for prediction.', 'VALIDATION_ERROR', 400);
    const result = await aiService.predictImportantTopics(parsed.data.questionPapers);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/explain', async (req, res, next) => {
  try {
    const payload = z.object({ topic: z.string().min(1) }).safeParse(req.body);
    if (!payload.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Topic is required' } });
    }

    const explanation = await aiService.explainTopic(payload.data.topic);
    return res.json({ success: true, data: explanation });
  } catch (error) {
    return next(error);
  }
});

router.post('/analyze-topic', async (req, res, next) => {
  try {
    const payload = z.object({ topic: z.string().min(1) }).safeParse(req.body);
    if (!payload.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Topic is required' } });
    }

    const topic = await prisma.topic.findFirst({
      where: { name: { contains: payload.data.topic, mode: 'insensitive' } },
      include: { questionTopics: { include: { question: { include: { questionPaper: true } } } } },
    });
    if (!topic) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No stored syllabus topic matches this request.' } });
    const years = [...new Set(topic.questionTopics.map((entry) => entry.question.questionPaper.year))].sort();
    const marksDistribution = topic.questionTopics.reduce<Record<string, number>>((distribution, entry) => {
      const markLabel = entry.marks ? `${entry.marks}-mark` : 'Unspecified';
      distribution[markLabel] = (distribution[markLabel] ?? 0) + 1;
      return distribution;
    }, {});
    const analysis = {
      topic: topic.name,
      frequency: topic.questionTopics.length,
      years,
      marksDistribution,
      importance: topic.importanceScore,
      message: topic.questionTopics.length ? undefined : 'No question-paper evidence is available for this topic yet.',
    };
    return res.json({ success: true, data: analysis });
  } catch (error) {
    return next(error);
  }
});

export { router as aiRouter };
