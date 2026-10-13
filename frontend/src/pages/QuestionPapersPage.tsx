import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '../components/ui/button';
import { apiFetch } from '../lib/api';

type Paper = {
  id: string;
  title: string;
  year: number;
  semester: string | null;
  examType: string;
  fileUrl: string | null;
  sourceUrl: string | null;
  subject: { id: string; code: string; name: string };
  _count: { questions: number };
};

type Subject = { id: string; name: string; code: string };

export function QuestionPapersPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [examType, setExamType] = useState('');
  const [marks, setMarks] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPapers = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (subjectId) query.set('subjectId', subjectId);
      if (year) query.set('year', year);
      if (semester) query.set('semester', semester);
      if (examType) query.set('examType', examType);
      if (marks) query.set('marks', marks);
      const result = await apiFetch<Paper[]>(`/question-papers${query.size ? `?${query}` : ''}`);
      setPapers(result);
      setSelected((previous) => previous.filter((id) => result.some((paper) => paper.id === id)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load question papers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiFetch<{ subjects: Subject[] }>('/subjects').then((result) => setSubjects(result.subjects)).catch(() => setSubjects([]));
  }, []);

  useEffect(() => {
    loadPapers();
  }, [subjectId, year, semester, examType, marks]);

  const togglePaper = (paperId: string) => setSelected((previous) => previous.includes(paperId) ? previous.filter((id) => id !== paperId) : [...previous, paperId]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm uppercase text-indigo-300">Academic archive</p><h1 className="mt-2 text-3xl font-bold text-white">Question Papers</h1></div><Link to="/analysis"><Button variant="outline">Analyze selected papers</Button></Link></header>
        <div className="mb-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm text-slate-300">Subject<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"><option value="">All subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} · {subject.name}</option>)}</select></label>
          <label className="text-sm text-slate-300">Year<input inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" placeholder="Any year" /></label>
          <label className="text-sm text-slate-300">Semester<input value={semester} onChange={(event) => setSemester(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" placeholder="Any semester" /></label>
          <label className="text-sm text-slate-300">Exam type<input value={examType} onChange={(event) => setExamType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" placeholder="CAT, Semester..." /></label>
          <label className="text-sm text-slate-300">Marks<input inputMode="numeric" value={marks} onChange={(event) => setMarks(event.target.value.replace(/\D/g, ''))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" placeholder="Any marks" /></label>
        </div>

        {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100"><p>{error}</p><Button variant="outline" className="mt-3" onClick={loadPapers}>Retry</Button></div>}
        {loading ? <p role="status" className="text-slate-300">Loading question papers...</p> : papers.length ? <div className="space-y-3">{papers.map((paper) => <article key={paper.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <label className="flex min-w-0 flex-1 items-start gap-3"><input type="checkbox" checked={selected.includes(paper.id)} onChange={() => togglePaper(paper.id)} aria-label={`Select ${paper.title}`} className="mt-1 h-4 w-4 accent-indigo-500" /><span><span className="block font-semibold text-white">{paper.title}</span><span className="mt-1 block text-sm text-slate-400">{paper.subject.code} · {paper.year} · {paper.semester ?? 'Semester unavailable'} · {paper.examType} · {paper._count.questions} questions</span></span></label>
          <div className="flex gap-2">{paper.fileUrl ? <a href={paper.fileUrl} download target="_blank" rel="noreferrer" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:border-slate-500">Download</a> : paper.sourceUrl ? <a href={paper.sourceUrl} target="_blank" rel="noreferrer" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:border-slate-500">Open source</a> : <Button size="sm" variant="outline" disabled>File unavailable</Button>}</div>
        </article>)}</div> : <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">No stored question papers match these filters yet. Import academic paper data or paste text to start the analysis workflow.<div className="mt-4 flex gap-3"><Button variant="outline" onClick={loadPapers}>Retry</Button></div></div>}
        <div className="fixed bottom-5 right-5">{selected.length > 0 && <Link to="/analysis" state={{ paperIds: selected }}><Button>Analyze {selected.length} selected</Button></Link>}</div>
      </div>
    </div>
  );
}