import { Router } from 'express';
import { z } from 'zod';

import { aiService } from '../services/aiService.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { aiRateLimit } from '../middleware/rateLimits.js';

const router = Router();
router.use(requireAuth);

const quizSchema = z.object({
  subject: z.string().min(1),
  unit: z.string().optional(),
  topic: z.string().optional(),
  questionType: z.string().optional(),
  difficulty: z.string().optional(),
  count: z.number().min(1).max(20).default(5),
  marks: z.number().min(1).max(20).default(2),
});

router.post('/generate', aiRateLimit, async (req, res, next) => {
  try {
    const parsed = quizSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid quiz payload' },
      });
    }

    const user = (req as unknown as AuthenticatedRequest).user;
    const payload = await aiService.generateQuiz({
      topic: parsed.data.topic || 'General Revision',
      difficulty: parsed.data.difficulty || 'Medium',
      marks: parsed.data.marks,
      count: parsed.data.count,
      subject: parsed.data.subject,
      unit: parsed.data.unit,
      questionType: parsed.data.questionType || 'MCQ',
    });

    const validatedQuestions = payload.questions.map((value) => {
      const question = value as Record<string, unknown>;
      return {
        question: String(question.question),
        options: Array.isArray(question.options) ? question.options.map(String) : [],
        correctAnswer: String(question.correctAnswer),
        explanation: String(question.explanation ?? ''),
        topic: String(question.topic ?? parsed.data.topic ?? 'General Revision'),
        difficulty: String(question.difficulty ?? parsed.data.difficulty ?? 'Medium'),
        marks: Number(question.marks ?? parsed.data.marks),
      };
    });
    const subject = await prisma.subject.findFirst({
      where: { OR: [{ id: parsed.data.subject }, { name: { equals: parsed.data.subject, mode: 'insensitive' } }] },
      select: { id: true },
    });
    const quiz = await prisma.quiz.create({
      data: {
        userId: user.id,
        subjectId: subject?.id,
        title: `${parsed.data.subject} - ${parsed.data.topic || 'Revision'}`,
        questions: { create: validatedQuestions },
      },
      include: { questions: true },
    });

    const questions = quiz.questions.map(({ correctAnswer: _correctAnswer, ...question }) => question);
    return res.status(201).json({ success: true, data: { quizId: quiz.id, questions } });
  } catch (error) {
    return next(error);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const history = await prisma.quizAttempt.findMany({
      where: { userId: user.id },
      include: { quiz: { select: { title: true, subjectId: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: { history } });
  } catch (error) {
    next(error);
  }
});

router.post(['/submit', '/:id/submit'], async (req, res, next) => {
  try {
    const parsed = z.object({ quizId: z.string().optional(), answers: z.array(z.object({ questionId: z.string(), answer: z.string() })) }).safeParse(req.body);
    if (!parsed.success) throw new AppError('Submit an answer for each quiz question.', 'VALIDATION_ERROR', 400);

    const user = (req as unknown as AuthenticatedRequest).user;
    const routeQuizId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const quizId = routeQuizId || parsed.data.quizId;
    if (!quizId) throw new AppError('Quiz ID is required.', 'VALIDATION_ERROR', 400);
    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, userId: user.id },
      include: { questions: true },
    });
    if (!quiz || !quiz.questions.length) throw new AppError('Quiz not found.', 'NOT_FOUND', 404);

    const answerMap = new Map(parsed.data.answers.map((answer) => [answer.questionId, answer.answer]));
    const results = quiz.questions.map((question) => {
      const answer = answerMap.get(question.id) ?? '';
      return {
        questionId: question.id,
        topic: question.topic ?? 'General',
        selectedAnswer: answer,
        correctAnswer: question.correctAnswer,
        correct: answer === question.correctAnswer,
        explanation: question.explanation,
      };
    });
    const score = results.filter((result) => result.correct).length;
    const accuracy = Math.round((score / quiz.questions.length) * 100);
    const topicResults = new Map<string, { correct: number; total: number }>();
    for (const result of results) {
      const item = topicResults.get(result.topic) ?? { correct: 0, total: 0 };
      item.total += 1;
      if (result.correct) item.correct += 1;
      topicResults.set(result.topic, item);
    }
    const topicPerformance = [...topicResults].map(([topic, value]) => ({ topic, ...value, accuracy: Math.round((value.correct / value.total) * 100) }));
    const attempt = await prisma.$transaction(async (transaction) => {
      const savedAttempt = await transaction.quizAttempt.create({
        data: { userId: user.id, quizId: quiz.id, score, total: quiz.questions.length, accuracy },
      });
      if (quiz.subjectId) {
        for (const [topicName, performance] of topicResults) {
          const topic = await transaction.topic.findFirst({
            where: { name: { equals: topicName, mode: 'insensitive' }, unit: { subjectId: quiz.subjectId } },
          });
          if (!topic) continue;
          const mastery = performance.correct / performance.total;
          await transaction.topicProgress.upsert({
            where: { userId_topicId: { userId: user.id, topicId: topic.id } },
            create: { userId: user.id, topicId: topic.id, mastery, lastStudied: new Date() },
            update: { mastery, lastStudied: new Date() },
          });
        }
      }
      return savedAttempt;
    });

    res.json({
      success: true,
      data: {
        attemptId: attempt.id,
        score,
        total: quiz.questions.length,
        correctAnswers: score,
        wrongAnswers: quiz.questions.length - score,
        accuracy,
        results,
        topicPerformance,
        weakTopics: topicPerformance.filter((topic) => topic.accuracy < 60).map((topic) => topic.topic),
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as quizRouter };
