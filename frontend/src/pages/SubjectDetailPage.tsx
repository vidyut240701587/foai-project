import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { apiFetch } from '../lib/api';
import { Link } from 'react-router-dom';

type Subject = {
  id: string;
  code: string;
  name: string;
  department: string;
  semester: string;
  examDate?: string;
  completion: number;
  importantTopics: string[];
  syllabus?: Array<{ unit: string; topics: Array<string | { id: string; name: string; completed: boolean }> }>;
  notes?: Array<{ title: string; unit: string; content: string; sourceUrl: string }>;
  questionPapers?: Array<{ id: string; year: number; examType: string; title: string; sourceUrl: string }>;
};

const tabs = ['Overview', 'Syllabus', 'Notes', 'PYQ Analysis', 'Quiz', 'Study Plan'] as const;

type Tab = (typeof tabs)[number];

export function SubjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingTopic, setSavingTopic] = useState('');
  const [plannerMessage, setPlannerMessage] = useState('');

  const loadSubject = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setSubject(await apiFetch<Subject>(`/subjects/${id}`));
    } catch (loadError) {
      setSubject(null);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this subject.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSubject(); }, [id]);

  const markTopic = async (topicId: string, completed: boolean) => {
    if (!id) return;
    setSavingTopic(topicId);
    setError('');
    try {
      await apiFetch(`/subjects/${id}/topics/${topicId}/progress`, { method: 'PATCH', body: JSON.stringify({ completed }) });
      await loadSubject();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update topic progress.');
    } finally {
      setSavingTopic('');
    }
  };

  const addTopicToPlanner = async (topicName: string) => {
    setSavingTopic(`planner:${topicName}`);
    setError('');
    setPlannerMessage('');
    try {
      await apiFetch('/planner/tasks', {
        method: 'POST',
        body: JSON.stringify({ subject: subject?.name, topic: topicName, durationMinutes: 30 }),
      });
      setPlannerMessage(`${topicName} was added to your planner.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to add this topic to your planner.');
    } finally {
      setSavingTopic('');
    }
  };

  if (loading) {
    return <div className="p-10 text-white">Loading subject details...</div>;
  }

  if (!subject) {
    return <div className="p-10 text-white">{error ? <div role="alert"><p>{error}</p><Button variant="outline" className="mt-4" onClick={loadSubject}>Retry</Button></div> : 'Subject not found.'}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-indigo-300">{subject.code}</p>
              <h1 className="mt-2 text-3xl font-bold text-white">{subject.name}</h1>
            </div>
            <Button onClick={() => navigate('/planner', { state: { subject: subject.name, topics: subject.syllabus?.flatMap((unit) => unit.topics.map((topic) => typeof topic === 'string' ? topic : topic.name)) ?? [] } })}>Generate study plan</Button>
          </div>
        </header>

        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-full px-3 py-2 text-sm ${tab === item ? 'bg-indigo-500 text-white' : 'border border-slate-700 bg-slate-900 text-slate-300'}`}
            >
              {item}
            </button>
          ))}
        </div>

        {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div>}
        {plannerMessage && <div role="status" className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">{plannerMessage} <Link to="/planner" className="ml-2 underline">View planner</Link></div>}

        {tab === 'Overview' && (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Card className="p-5">
              <div className="text-sm text-slate-400">Exam date</div>
              <div className="mt-2 text-xl font-semibold text-white">{subject.examDate ? new Date(subject.examDate).toLocaleDateString() : 'Not set'}</div>
            </Card>
            <Card className="p-5">
              <div className="text-sm text-slate-400">Completion</div>
              <div className="mt-2 text-xl font-semibold text-white">{subject.completion}%</div>
            </Card>
            <Card className="p-5">
              <div className="text-sm text-slate-400">Department</div>
              <div className="mt-2 text-xl font-semibold text-white">{subject.department}</div>
            </Card>
          </div>
        )}

        {tab === 'Syllabus' && (
          <div className="space-y-4">
            {(subject.syllabus || []).map((unit) => (
              <Card key={unit.unit} className="p-5">
                <h3 className="text-lg font-semibold text-white">{unit.unit}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {unit.topics.map((entry) => {
                    const topic = typeof entry === 'string' ? { name: entry, id: '', completed: false } : entry;
                    return <div key={topic.id || topic.name} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 p-3">
                      <span className="text-sm text-slate-200">{topic.name}</span>
                      {topic.id && <Button size="sm" variant="outline" disabled={savingTopic === topic.id} onClick={() => markTopic(topic.id, !topic.completed)}>{topic.completed ? 'Mark incomplete' : savingTopic === topic.id ? 'Saving...' : 'Mark complete'}</Button>}
                      <Button size="sm" variant="ghost" onClick={() => navigate('/ai', { state: { prompt: `Help me study ${topic.name} for ${subject.name}.` } })}>Study topic</Button>
                      <Button size="sm" variant="ghost" disabled={savingTopic === `planner:${topic.name}`} onClick={() => addTopicToPlanner(topic.name)}>{savingTopic === `planner:${topic.name}` ? 'Adding...' : 'Add to planner'}</Button>
                    </div>;
                  })}
                </div>
              </Card>
            ))}
            {!subject.syllabus?.length && <Card className="p-5"><p className="text-slate-300">No syllabus data is available for this subject yet.</p><p className="mt-2 text-sm text-slate-400">Import official syllabus content or update this subject from your academic records.</p></Card>}
          </div>
        )}

        {tab === 'Notes' && (
          <div className="space-y-4">
            {(subject.notes || []).map((note) => (
              <Card key={note.title} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{note.title}</h3>
                    <p className="text-sm text-slate-400">{note.unit}</p>
                  </div>
                  <a href={note.sourceUrl} className="text-sm text-indigo-300">Open</a>
                </div>
                <p className="mt-4 text-sm text-slate-300">{note.content}</p>
              </Card>
            ))}
          </div>
        )}

        {tab === 'PYQ Analysis' && (
          <Card className="p-5"><h3 className="text-xl font-semibold text-white">Question-paper analysis</h3><p className="mt-3 text-sm text-slate-300">Analyze stored papers when source-backed records are available.</p><Link to={`/analysis?subjectId=${encodeURIComponent(subject.id)}`} className="mt-4 inline-block text-sm text-indigo-300">Open analysis</Link></Card>
        )}

        {tab === 'Quiz' && (
          <Card className="p-5">
            <h3 className="text-xl font-semibold text-white">Quick quiz</h3>
            <p className="mt-2 text-slate-300">Generate a short AI quiz for the most recurring topic in this subject.</p>
            <Button className="mt-5" onClick={() => navigate('/quiz', { state: { subject: subject.name, topic: subject.importantTopics?.[0] ?? '' } })}>Generate quiz</Button>
          </Card>
        )}

        {tab === 'Study Plan' && (
          <Card className="p-5">
            <h3 className="text-xl font-semibold text-white">Recommended plan</h3>
            <p className="mt-3 text-slate-300">Create a plan using the syllabus topics you want to study.</p><Button className="mt-4" onClick={() => navigate('/planner', { state: { subject: subject.name, topics: subject.syllabus?.flatMap((unit) => unit.topics.map((topic) => typeof topic === 'string' ? topic : topic.name)) ?? [] } })}>Open planner</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
