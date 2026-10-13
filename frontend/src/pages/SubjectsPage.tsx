import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { Button } from '../components/ui/button';
import { apiFetch } from '../lib/api';

type Subject = {
  id: string;
  code: string;
  name: string;
  examDate?: string;
  completion: number;
  importantTopics: string[];
};

export function SubjectsPage() {
  const [searchParams] = useSearchParams();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSubjects = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch<{ subjects: Subject[] }>('/subjects');
      setSubjects(response.subjects);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load subjects. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  const visibleSubjects = subjects.filter((subject) => `${subject.code} ${subject.name} ${subject.importantTopics.join(' ')}`.toLowerCase().includes((searchParams.get('search') ?? '').trim().toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white">My Subjects</h1>
          <p className="mt-2 text-slate-400">Your selected subjects and saved progress.</p>
        </header>

        {loading ? <div role="status" className="text-slate-300">Loading subjects...</div> : error ? (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-100"><p>{error}</p><Button variant="outline" className="mt-3" onClick={loadSubjects}>Retry</Button></div>
        ) : visibleSubjects.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">No subjects have been added to your account yet. Complete onboarding or add subjects from settings.</div>
        ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleSubjects.map((subject) => (
            <Link key={subject.id} to={`/subjects/${subject.id}`} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-soft transition hover:border-indigo-500 hover:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-xs text-indigo-200">{subject.code}</span>
                {subject.examDate && <span className="text-xs text-slate-400">{new Date(subject.examDate).toLocaleDateString()}</span>}
              </div>

              <h2 className="text-xl font-semibold text-white">{subject.name}</h2>

              <div className="mt-5">
                <div className="mb-2 flex justify-between text-sm text-slate-300">
                  <span>Completion</span>
                  <span>{subject.completion}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, subject.completion))}%` }} />
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm text-slate-400">Important topics</p>
                <div className="flex flex-wrap gap-2">
                  {subject.importantTopics.map((topic) => (
                    <span key={topic} className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200">{topic}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
