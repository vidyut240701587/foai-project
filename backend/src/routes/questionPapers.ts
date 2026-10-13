import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const marks = req.query.marks ? Number(req.query.marks) : undefined;
    const papers = await prisma.questionPaper.findMany({
      where: {
        subjectId: typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined,
        year: req.query.year ? Number(req.query.year) : undefined,
        semester: typeof req.query.semester === 'string' ? req.query.semester : undefined,
        examType: typeof req.query.examType === 'string' ? { contains: req.query.examType, mode: 'insensitive' } : undefined,
        questions: marks ? { some: { marks } } : undefined,
      },
      include: { subject: { select: { id: true, code: true, name: true } }, _count: { select: { questions: true } } },
      orderBy: [{ year: 'desc' }, { title: 'asc' }],
    });
    res.json({ success: true, data: papers });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const paper = await prisma.questionPaper.findUnique({
      where: { id: req.params.id },
      include: { subject: true, questions: true },
    });
    if (!paper) throw new AppError('Question paper not found.', 'NOT_FOUND', 404);
    res.json({ success: true, data: paper });
  } catch (error) {
    next(error);
  }
});

export { router as questionPapersRouter };
