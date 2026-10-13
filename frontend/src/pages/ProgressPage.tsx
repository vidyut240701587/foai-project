import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from 'recharts';

import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { apiFetch } from '../lib/api';

type ProgressSummary = {
  overallCompletion: number;
  completedTopics: number;
  totalTopics: number;
  subjectCompletion: Array<{ subject: string; completion: number }>;
  quizAccuracy: number;
  quizAttempts: number;
  weakTopics: Array<{ topic: string; subject: string; mastery: number }>;
  activity: Array<{ type: string; date: string; title: string }>;
};

export function ProgressPage() {
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setSummary(await apiFetch<ProgressSummary>('/progress'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load progress. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activityData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const count = summary?.activity.filter((item) => new Date(item.date).toDateString() === date.toDateString()).length ?? 0;
    return { day: date.toLocaleDateString(undefined, { weekday: 'short' }), activities: count };
  });
  const topicData = summary?.weakTopics.map((item) => ({ topic: item.topic, mastery: Math.round(item.mastery * 100) })) ?? [];

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-indigo-300">Progress</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Academic momentum dashboard</h1>
        </header>

        {loading && <div role="status" className="mb-5 text-slate-300">Loading progress...</div>}
        {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100"><p>{error}</p><Button variant="outline" className="mt-3" onClick={load}>Retry</Button></div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {([
            ['Overall completion', `${summary?.overallCompletion ?? 0}%`],
            ['Topics completed', `${summary?.completedTopics ?? 0} / ${summary?.totalTopics ?? 0}`],
            ['Quiz accuracy', `${summary?.quizAccuracy ?? 0}%`],
            ['Quiz attempts', String(summary?.quizAttempts ?? 0)],
          ]).map(([label, value]) => (
            <Card key={label} className="p-5">
              <div className="text-sm text-slate-400">{label}</div>
              <div className="mt-3 text-3xl font-bold text-white">{value}</div>
            </Card>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4 text-lg font-semibold text-white">Weekly study activity</div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="activities" fill="#6366f1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 text-lg font-semibold text-white">Tracked topic mastery</div>
            <div className="h-60">
              {topicData.length ? <ResponsiveContainer width="100%" height="100%">
                <LineChart data={topicData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="topic" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Line type="monotone" dataKey="mastery" stroke="#22d3ee" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Topic activity will appear after syllabus topics are available and tracked.</div>}
            </div>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4 text-lg font-semibold text-white">Topics to review</div>
            <div className="space-y-4">
              {summary?.weakTopics.length ? summary.weakTopics.map((item) => <div key={`${item.subject}-${item.topic}`} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="flex justify-between text-sm text-slate-300"><span>{item.topic} · {item.subject}</span><span>{Math.round(item.mastery * 100)}%</span></div><div className="mt-2 h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(0, Math.min(100, item.mastery * 100))}%` }} /></div></div>) : <p className="text-sm text-slate-400">No weak topics recorded.</p>}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 text-lg font-semibold text-white">Subject progress</div>
            <div className="space-y-3">
              {summary?.subjectCompletion.map(({ subject, completion }) => (
                <div key={subject} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div className="mb-2 flex justify-between text-sm text-slate-300">
                    <span>{subject}</span>
                    <span>{completion}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completion}%` }} />
                  </div>
                </div>
              ))}
              {!summary?.subjectCompletion.length && <p className="text-sm text-slate-400">No subject progress is available yet.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
