import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import prisma from '../lib/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { academicImportService } from '../services/academicImportService.js';
import { aiService } from '../services/aiService.js';
import { env } from '../config/env.js';
import { aiRateLimit, uploadRateLimit } from '../middleware/rateLimits.js';

const router = Router();
router.use(requireAuth);
const analysisRateLimit = aiRateLimit;

const allowedMimeTypes: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed',
  ],
  '.txt': ['text/plain'],
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(path.posix.basename(file.originalname.replace(/\\/g, '/'))).toLowerCase();
    if (!allowedMimeTypes[extension]?.includes(file.mimetype.toLowerCase())) {
      callback(new AppError('Only PDF, DOCX, and TXT question papers are supported.', 'UNSUPPORTED_FORMAT', 415));
      return;
    }
    callback(null, true);
  },
});

function getSafeUploadMetadata(file: Express.Multer.File) {
  const originalName = path.posix.basename(file.originalname.replace(/\\/g, '/'));
  const extension = path.extname(originalName).toLowerCase();
  const signature = file.buffer.subarray(0, 4).toString();
  if (extension === '.pdf' && signature !== '%PDF') {
    throw new AppError('The uploaded PDF file is invalid.', 'INVALID_FILE', 415);
  }
  if (extension === '.docx' && !signature.startsWith('PK')) {
    throw new AppError('The uploaded DOCX file is invalid.', 'INVALID_FILE', 415);
  }
  if (extension === '.txt' && file.buffer.includes(0)) {
    throw new AppError('The uploaded TXT file is invalid.', 'INVALID_FILE', 415);
  }

  const displayName = originalName.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || `question-paper${extension}`;
  return { storedFilename: `${randomUUID()}${extension}`, displayName };
}

const analysisSchema = z.object({
  questionPapers: z.array(z.string()).min(2),
  subjectId: z.string().optional(),
});

const uploadAnalysisSchema = z.object({
  subjectId: z.string().min(1),
  year: z.coerce.number().int().min(1900).max(2200),
  examType: z.enum(['CAT1', 'CAT2', 'Semester']),
});

function normalizePriority(frequency: number, confidence: number) {
  if (confidence >= 0.85 || frequency >= 6) return 'Very High';
  if (confidence >= 0.7 || frequency >= 4) return 'High';
  if (confidence >= 0.55 || frequency >= 2) return 'Medium';
  return 'Low';
}

function normalizeConfidence(frequency: number, repeatedPapers: number, marksSupport: number, syllabusAlignment: number) {
  const raw = (frequency * 0.35 + repeatedPapers * 0.25 + marksSupport * 0.2 + syllabusAlignment * 0.2) / 1;
  return Math.max(0.1, Math.min(0.98, raw / 6));
}

async function buildAnalysisPayload(userId: string, subjectId: string) {
  const [subject, papers] = await Promise.all([
    prisma.subject.findFirst({
      where: { id: subjectId, OR: [{ externalId: { not: null } }, { userSubjects: { some: { userId } } }] },
      select: { name: true },
    }),
    prisma.questionPaper.findMany({
      where: { userId, subjectId },
      include: {
        questions: {
          include: { questionTopics: { include: { topic: { include: { unit: true } } } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!subject || papers.length < 2) {
    throw new AppError('No uploaded papers are available yet. Upload previous-year question papers to begin analysis.', 'NO_UPLOADED_PAPERS', 404);
  }

  const topicMap = new Map<string, { topic: string; unit: string; frequency: number; marks: number[]; papers: Set<string>; confidence: number; repeatedPapers: number; }>();
  const marksMap = new Map<number, number>();
  let totalQuestions = 0;
  const subjectLabel = subject.name;

  for (const paper of papers) {
    for (const question of paper.questions) {
      totalQuestions += 1;
      const normalizedMarks = question.marks ?? 0;
      if (normalizedMarks > 0) marksMap.set(normalizedMarks, (marksMap.get(normalizedMarks) ?? 0) + 1);

      const topics = question.questionTopics.length
        ? question.questionTopics.map((entry) => ({ name: entry.topic.name, unit: entry.topic.unit?.name ?? 'Unmapped' }))
        : [{ name: 'Unmapped', unit: 'Unmapped' }];

      for (const item of topics) {
        const key = item.name.trim() || 'Unmapped';
        const record = topicMap.get(key) ?? { topic: key, unit: item.unit || 'Unmapped', frequency: 0, marks: [], papers: new Set<string>(), confidence: 0, repeatedPapers: 0 };
        record.frequency += 1;
        record.papers.add(paper.id);
        if (item.unit && item.unit !== 'Unmapped') record.unit = item.unit;
        if (question.marks) record.marks.push(question.marks);
        topicMap.set(key, record);
      }
    }
  }

  const topics = [...topicMap.entries()].map(([name, record]) => {
    const repeatedPapers = record.papers.size;
    const marksSupport = record.marks.length ? Math.max(...record.marks) : 1;
    const confidence = normalizeConfidence(record.frequency, repeatedPapers, marksSupport, repeatedPapers > 0 ? 1 : 0.2);
    return {
      topic: name,
      unit: record.unit || 'Unmapped',
      frequency: record.frequency,
      paperCount: repeatedPapers,
      marks: record.marks,
      priority: normalizePriority(record.frequency, confidence),
      confidence,
    };
  }).sort((left, right) => right.frequency - left.frequency || right.confidence - left.confidence);

  const repeatedTopics = topics.filter((topic) => topic.topic !== 'Unmapped' && topic.paperCount >= 2).slice(0, 10);
  const highPriorityTopics = repeatedTopics.slice(0, 5);
  const marksDistribution = [...marksMap].map(([marks, count]) => ({ marks, count })).sort((left, right) => left.marks - right.marks);

  const predicted2MarkQuestions = highPriorityTopics.slice(0, 4).map((topic) => ({
        question: `The uploaded papers include ${topic.topic}; review its key definition and concepts for a short-answer question.`,
        topic: topic.topic,
        unit: topic.unit,
        frequency: topic.frequency,
        confidence: Math.round(topic.confidence * 100) / 100,
        reason: `Matched to the selected subject syllabus and found in ${topic.paperCount} distinct uploaded papers.`,
      }));

  const predicted11MarkQuestions = highPriorityTopics.slice(0, 3).map((topic) => ({
        question: `The uploaded papers include ${topic.topic}; prepare a detailed answer using its syllabus coverage.`,
        topic: topic.topic,
        unit: topic.unit,
        frequency: topic.frequency,
        confidence: Math.round(topic.confidence * 100) / 100,
        reason: `Matched to the selected subject syllabus and found in ${topic.paperCount} distinct uploaded papers.`,
      }));

  const structured = {
    subject: subjectLabel,
    papersAnalyzed: papers.length,
    questionsAnalyzed: totalQuestions,
    uniqueTopics: topics.length,
    repeatedTopics: repeatedTopics.length,
    topics,
    repeatedTopicsList: repeatedTopics,
    marksDistribution,
    predicted2MarkQuestions,
    predicted11MarkQuestions,
    highPriorityTopics,
    disclaimer: 'AI predictions are based on patterns in uploaded question papers and syllabus context. They are not guaranteed exam questions.',
  };

  return structured;
}

async function analyzeQuestionPapers(ids: string[], userId: string) {
  const papers = await prisma.questionPaper.findMany({
    where: { id: { in: ids }, userId },
    include: { questions: { include: { questionTopics: { include: { topic: true } } } } },
  });
  if (papers.length !== ids.length) throw new AppError('One or more question papers were not found in your account.', 'NOT_FOUND', 404);
  if (papers.length < 2) throw new AppError('Upload at least two question papers to analyze.', 'INSUFFICIENT_DATA', 422);
  const questions = papers.flatMap((paper) => paper.questions.map((question) => ({ paper, question })));
  if (!questions.length) throw new AppError('These papers do not contain question data for analysis.', 'INSUFFICIENT_DATA', 422);

  const topicYears = new Map<string, Set<number>>();
  const marksDistribution: Record<string, number> = {};
  for (const { paper, question } of questions) {
    const topics = new Set([
      ...question.questionTopics.map((entry) => entry.topic.name),
      ...question.topicTags,
    ]);
    for (const topic of topics) {
      const years = topicYears.get(topic) ?? new Set<number>();
      years.add(paper.year);
      topicYears.set(topic, years);
    }
    const markLabel = question.marks ? `${question.marks}-mark` : 'Unspecified';
    marksDistribution[markLabel] = (marksDistribution[markLabel] ?? 0) + 1;
  }

  const topicFrequency = [...topicYears].map(([topic, years]) => ({ topic, frequency: years.size, years: [...years].sort() })).sort((left, right) => right.frequency - left.frequency);
  return {
    papersAnalyzed: papers.length,
    questionsAnalyzed: questions.length,
    repeatedTopics: topicFrequency.filter((item) => item.frequency > 1),
    topicFrequency,
    marksDistribution,
    yearDistribution: papers.reduce<Record<string, number>>((distribution, paper) => {
      distribution[String(paper.year)] = (distribution[String(paper.year)] ?? 0) + 1;
      return distribution;
    }, {}),
    importantTopics: topicFrequency.filter((item) => item.frequency > 1).map((item) => item.topic),
  };
}

router.post('/question-papers', analysisRateLimit, async (req, res, next) => {
  try {
    const parsed = analysisSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid analysis payload' },
      });
    }

    const user = (req as AuthenticatedRequest).user;
    const analysis = await analyzeQuestionPapers(parsed.data.questionPapers, user.id);
    const localPapers = await prisma.questionPaper.findMany({
      where: { id: { in: parsed.data.questionPapers }, userId: user.id },
      include: { questions: true },
    });
    let aiAnalysis: unknown;
    if (env.geminiApiKey) {
      try {
        aiAnalysis = await aiService.analyzeTopics(localPapers.map((paper) => ({
          year: paper.year,
          subjectId: paper.subjectId,
          title: paper.title,
          examType: paper.examType,
          questions: paper.questions.map((question) => ({ text: question.text, marks: question.marks, topics: question.topicTags })),
        })));
      } catch {
        aiAnalysis = { status: 'unavailable', message: 'AI service is temporarily unavailable. Showing analysis from stored question data.' };
      }
    } else {
      aiAnalysis = { status: 'not_configured', message: 'AI service is not configured. Showing analysis from stored question data.' };
    }
    const result = { ...analysis, aiAnalysis };
    await prisma.aIAnalysis.create({
      data: { userId: user.id, subjectId: parsed.data.subjectId, type: 'question-papers', payload: result as Prisma.InputJsonValue },
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
});

router.post('/upload', uploadRateLimit, upload.array('files'), async (req, res, next) => {
  try {
    const parsed = uploadAnalysisSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Submit the uploaded question papers with subject metadata.', 'VALIDATION_ERROR', 400, parsed.error.flatten().fieldErrors);
    }

    const files = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
    if (files.length < 2) throw new AppError('Select at least two question-paper files to analyze.', 'INSUFFICIENT_DATA', 422);

    const user = (req as AuthenticatedRequest).user;
    const subjectId = parsed.data.subjectId;
    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        OR: [
          { externalId: { not: null } },
          { userSubjects: { some: { userId: user.id } } },
        ],
      },
      select: { id: true, name: true },
    });
    if (!subject) throw new AppError('Select a subject from your academic records.', 'NOT_FOUND', 404);
    const subjectName = subject.name;

    const uploadedPapers = [] as Array<{ filename: string; status: 'uploaded' | 'processed'; questionCount: number; paperId: string }>;
    for (const file of files) {
      const { storedFilename, displayName } = getSafeUploadMetadata(file);
      const result = await academicImportService.importUpload(file.buffer, storedFilename, {
        userId: user.id,
        subjectId: subject.id,
        year: parsed.data.year,
        examType: parsed.data.examType,
      });
      uploadedPapers.push({
        filename: displayName,
        status: 'processed',
        questionCount: Number((result as { questionsImported?: number }).questionsImported ?? 0),
        paperId: String((result as { paperId?: string }).paperId ?? ''),
      });
    }

    const analysis = await buildAnalysisPayload(user.id, subjectId);
    const record = await prisma.aIAnalysis.create({
      data: {
        userId: user.id,
        subjectId,
        type: 'file-analysis',
        payload: { subject: subjectName, uploadedPapers, analysis, createdAt: new Date().toISOString() } as Prisma.InputJsonValue,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        analysis,
        uploadedPapers,
        analysisId: record.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:subjectId', analysisRateLimit, async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const subjectId = Array.isArray(req.params.subjectId) ? req.params.subjectId[0] : req.params.subjectId;
    const papers = await prisma.questionPaper.findMany({ where: { subjectId, userId: user.id }, select: { id: true } });
    if (papers.length < 2) throw new AppError('There is not enough question-paper data to analyze this subject yet.', 'INSUFFICIENT_DATA', 422);
    const analysis = await analyzeQuestionPapers(papers.map((paper) => paper.id), user.id);
    res.json({ success: true, data: analysis });
  } catch (error) {
    next(error);
  }
});

export { router as analysisRouter };
