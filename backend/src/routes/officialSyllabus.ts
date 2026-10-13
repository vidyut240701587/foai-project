import { Router } from 'express';

import { recSyllabusCatalog } from '../services/recSyllabusCatalog.js';

const router = Router();
const unavailableMessage = 'Official syllabus is currently unavailable for this selection.';

router.get('/regulations', (_req, res) => {
  res.json({ success: true, data: recSyllabusCatalog.getRegulations() });
});

router.get('/departments', (req, res) => {
  const regulation = String(req.query.regulation ?? '').trim().toUpperCase();
  const departments = recSyllabusCatalog.getDepartments(regulation).map(({ code, name }) => ({ code, name }));
  res.json({ success: true, data: departments });
});

router.get('/semesters', async (req, res) => {
  try {
    const regulation = String(req.query.regulation ?? '').trim().toUpperCase();
    const department = String(req.query.department ?? '').trim().toUpperCase();
    const curriculum = await recSyllabusCatalog.getCurriculum(regulation, department);
    const semesters = [...new Set(curriculum.subjects.map((subject) => subject.semester))].sort((a, b) => a - b);
    res.json({ success: true, data: semesters });
  } catch {
    res.json({ success: true, data: [], message: unavailableMessage });
  }
});

router.get('/subjects', async (req, res) => {
  try {
    const regulation = String(req.query.regulation ?? '').trim().toUpperCase();
    const department = String(req.query.department ?? '').trim().toUpperCase();
    const semester = Number(req.query.semester);
    if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
      res.json({ success: true, data: [], message: unavailableMessage });
      return;
    }

    const curriculum = await recSyllabusCatalog.getCurriculum(regulation, department);
    const subjects = curriculum.subjects.filter((subject) => subject.semester === semester);
    res.json({
      success: true,
      data: subjects,
      message: subjects.length ? undefined : unavailableMessage,
    });
  } catch {
    res.json({ success: true, data: [], message: unavailableMessage });
  }
});

router.get('/download', async (req, res) => {
  try {
    const regulation = String(req.query.regulation ?? '').trim().toUpperCase();
    const department = String(req.query.department ?? '').trim().toUpperCase();
    const subjectCode = String(req.query.subjectCode ?? '').trim().toUpperCase();
    const curriculum = await recSyllabusCatalog.getCurriculum(regulation, department);
    if (!curriculum.subjects.some((subject) => subject.code === subjectCode)) {
      res.status(404).json({ success: false, error: unavailableMessage });
      return;
    }

    const filename = `REC_${regulation}_${department}_Curriculum_and_Syllabus.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(curriculum.buffer);
  } catch {
    res.status(502).json({ success: false, error: unavailableMessage });
  }
});

export { router as officialSyllabusRouter };