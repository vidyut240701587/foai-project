import mammoth from 'mammoth';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

import prisma from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';

const require = createRequire(import.meta.url);
const parsePdf = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;

type ParsedQuestion = { text: string; marks?: number };
type ImportMetadata = {
  userId: string;
  subjectId: string;
  year: number;
  examType: string;
};

export function parseQuestionPaperText(text: string): ParsedQuestion[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const questionStarts: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*(?:Q(?:uestion)?\s*)?\d{1,2}\s*[.)](?:\s|$)/i.test(lines[index])) questionStarts.push(index);
  }
  if (!questionStarts.length) {
    throw new AppError('No numbered questions could be extracted from this paper.', 'IMPORT_NO_QUESTIONS', 422);
  }

  const questions: ParsedQuestion[] = [];
  for (let index = 0; index < questionStarts.length; index += 1) {
    const start = questionStarts[index];
    const end = questionStarts[index + 1] ?? lines.length;
    const block = lines.slice(start, end)
      .join(' ')
      .replace(/^\s*(?:Q(?:uestion)?\s*)?\d{1,2}\s*[.)]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!block) continue;
    const mark = /(?:\[\s*(\d{1,2})\s*(?:marks?)?\s*\]|\(\s*(\d{1,2})\s*(?:marks?)?\s*\)|\b(\d{1,2})\s*(?:marks?|M)\b)/i.exec(block);
    const marks = mark ? Number(mark[1] ?? mark[2] ?? mark[3]) : undefined;
    const questionText = mark ? block.replace(mark[0], '').replace(/\s+/g, ' ').trim() : block;
    if (questionText.length > 3) questions.push({ text: questionText, marks });
  }
  if (!questions.length) throw new AppError('No readable questions could be extracted.', 'IMPORT_NO_QUESTIONS', 422);
  return questions;
}

function normalizeExamType(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (['CAT1', 'CAT2'].includes(normalized)) return normalized;
  if (normalized === 'SEMESTER') return 'Semester';
  throw new AppError('Exam type must be CAT1, CAT2, or Semester.', 'IMPORT_INVALID_EXAM_TYPE', 400);
}

export const academicImportService = {
  async importUpload(buffer: Buffer, filename: string, metadata: ImportMetadata) {
    const extension = filename.toLowerCase().split('.').pop();
    let text: string;
    if (extension === 'pdf') text = (await parsePdf(buffer)).text;
    else if (extension === 'docx') text = (await mammoth.extractRawText({ buffer })).value;
    else if (extension === 'txt') text = buffer.toString('utf8');
    else throw new AppError('Supported question-paper formats are PDF, DOCX, and TXT.', 'UNSUPPORTED_FORMAT', 415);

    return this.importQuestionPaperText(text, filename, metadata);
  },

  async importQuestionPaperText(text: string, filename: string, metadata: ImportMetadata) {
    if (!metadata.userId || !metadata.subjectId || !metadata.year || !metadata.examType) {
      throw new AppError('Select a subject, year, and exam type for the uploaded question paper.', 'IMPORT_METADATA_REQUIRED', 400);
    }

    const subject = await prisma.subject.findFirst({
      where: {
        id: metadata.subjectId,
        OR: [
          { externalId: { not: null } },
          { userSubjects: { some: { userId: metadata.userId } } },
        ],
      },
      include: { units: { include: { topics: true } } },
    });
    if (!subject) throw new AppError('Select a subject from your academic records.', 'NOT_FOUND', 404);

    const questions = parseQuestionPaperText(text);
    const examType = normalizeExamType(metadata.examType);
    const externalId = createHash('sha256')
      .update(`${metadata.userId}:${subject.id}:${metadata.year}:${examType}:${filename}:${questions.map((question) => question.text).join('|')}`)
      .digest('hex');
    const paper = await prisma.questionPaper.upsert({
      where: { externalId },
      create: {
        externalId,
        userId: metadata.userId,
        subjectId: subject.id,
        year: metadata.year,
        examType,
        title: filename,
        metadata: { importedAt: new Date().toISOString() },
      },
      update: { userId: metadata.userId, subjectId: subject.id, year: metadata.year, examType, title: filename },
    });

    await prisma.questionTopic.deleteMany({ where: { question: { questionPaperId: paper.id } } });
    await prisma.question.deleteMany({ where: { questionPaperId: paper.id } });
    let linkedTopics = 0;
    const matchedTopicIds = new Set<string>();
    const syllabusTopics = subject.units.flatMap((unit) => unit.topics.map((topic) => ({ ...topic, unit })));

    for (const question of questions) {
      const match = syllabusTopics
        .filter((topic) => topic.name.length >= 4 && question.text.toLowerCase().includes(topic.name.toLowerCase()))
        .sort((left, right) => right.name.length - left.name.length)[0];
      await prisma.question.create({
        data: {
          questionPaperId: paper.id,
          text: question.text,
          marks: question.marks,
          topicTags: match ? [match.name] : ['Unmapped'],
          questionTopics: match ? { create: { topicId: match.id, marks: question.marks } } : undefined,
        },
      });
      if (match) {
        linkedTopics += 1;
        matchedTopicIds.add(match.id);
      }
    }

    for (const topicId of matchedTopicIds) {
      const frequency = await prisma.questionTopic.count({ where: { topicId } });
      await prisma.topic.update({ where: { id: topicId }, data: { questionFrequency: frequency } });
    }

    return { kind: 'question-paper', paperId: paper.id, questionsImported: questions.length, topicMatches: linkedTopics };
  },
};