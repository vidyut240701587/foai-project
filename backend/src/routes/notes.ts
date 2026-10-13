import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);
const noteSchema = z.object({
  subjectId: z.string().min(1),
  title: z.string().min(1).max(160),
  unitName: z.string().optional(),
  content: z.string().min(1).max(50000),
  sourceUrl: z.string().url().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const notes = await prisma.note.findMany({
      where: { subject: { userSubjects: { some: { userId: user.id } } } },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { lastSynced: 'desc' },
    });
    res.json({ success: true, data: notes });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Enter a subject, title, and note content.', 'VALIDATION_ERROR', 400, parsed.error.flatten().fieldErrors);
    const user = (req as AuthenticatedRequest).user;
    const subject = await prisma.subject.findFirst({ where: { id: parsed.data.subjectId, userSubjects: { some: { userId: user.id } } } });
    if (!subject) throw new AppError('Subject not found.', 'NOT_FOUND', 404);
    const note = await prisma.note.create({
      data: { ...parsed.data, unitName: parsed.data.unitName || null, sourceUrl: parsed.data.sourceUrl || null, sourceType: 'USER' },
    });
    res.status(201).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const note = await prisma.note.findFirst({ where: { id: req.params.id, subject: { userSubjects: { some: { userId: user.id } } } }, include: { subject: true } });
    if (!note) throw new AppError('Note not found.', 'NOT_FOUND', 404);
    res.json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const parsed = noteSchema.omit({ subjectId: true }).partial().safeParse(req.body);
    if (!parsed.success) throw new AppError('Invalid note update.', 'VALIDATION_ERROR', 400, parsed.error.flatten().fieldErrors);
    const note = await prisma.note.findFirst({ where: { id: req.params.id, subject: { userSubjects: { some: { userId: user.id } } } } });
    if (!note) throw new AppError('Note not found.', 'NOT_FOUND', 404);
    const updated = await prisma.note.update({ where: { id: note.id }, data: parsed.data });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const user = (req as unknown as AuthenticatedRequest).user;
    const note = await prisma.note.findFirst({ where: { id: req.params.id, subject: { userSubjects: { some: { userId: user.id } } } } });
    if (!note) throw new AppError('Note not found.', 'NOT_FOUND', 404);
    await prisma.note.delete({ where: { id: note.id } });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

export { router as notesRouter };
