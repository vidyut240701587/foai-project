import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '../components/ui/button';
import { apiFetch } from '../lib/api';

type DashboardData = {
  progress: {
    overallCompletion: number;
    completedTopics: number;
    totalTopics: number;
    quizAccuracy: number;
    subjectCompletion: Array<{ subjectId: string; subject: string; completion: number }>;
    weakTopics: Array<{ topic: string; subject: string }>;
  };
  plan: { current: { tasks: Array<{ id: string; title: string; scheduledAt: string | null; durationMinutes: number | null; priority: number | null; status: string }> } | null };
  profile: { user: { name: string }; profile: { preferredHours: number | null; examDates: unknown } | null };
};
type ServiceState = { backend: string; database: string; gemini: string };

export async function loadDashboard() {
  return apiFetch('/progress');
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [services, setServices] = useState<ServiceState>({ backend: 'Checking', database: 'Checking', gemini: 'Checking' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [progress, plan, profile] = await Promise.all([
        apiFetch<DashboardData['progress']>('/progress'),
        apiFetch<DashboardData['plan']>('/planner'),
        apiFetch<DashboardData['profile']>('/auth/profile'),
      ]);
      setData({ progress, plan, profile });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    apiFetch<{ status: string; services: { database: { status: string } } }>('/health')
      .then((health) => setServices((current) => ({ ...current, backend: 'Connected', database: health.services.database.status === 'ok' ? 'Available' : 'Unavailable' })))
      .catch(() => setServices({ backend: 'Offline', database: 'Unavailable', gemini: 'Unavailable' }));
    apiFetch<{ status: string }>('/health/ai')
      .then((status) => {
        setServices((current) => ({ ...current, gemini: status.status === 'healthy' ? 'Healthy' : status.status }));
      })
      .catch((statusError) => {
        setServices((current) => ({
          ...current,
          gemini: statusError instanceof Error && statusError.message.includes('not configured') ? 'Not configured' : 'Unavailable',
        }));
      });
  }, []);

  const examDates = Array.isArray(data?.profile.profile?.examDates) ? data.profile.profile.examDates.filter((date): date is string => typeof date === 'string') : [];
  const nextExam = examDates.map((date) => new Date(date)).filter((date) => date.getTime() >= Date.now()).sort((left, right) => left.getTime() - right.getTime())[0];
  const daysToExam = nextExam ? Math.ceil((nextExam.getTime() - Date.now()) / 86400000) : null;
  const todayKey = new Date().toDateString();
  const todayTasks = data?.plan.current?.tasks.filter((task) => task.scheduledAt && new Date(task.scheduledAt).toDateString() === todayKey && task.status === 'pending') ?? [];

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Welcome back, {data?.profile.user.name ?? 'student'}</p>
            <h1 className="text-3xl font-bold">Here&apos;s what you should focus on today.</h1>
          </div>
        </header>

        {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100"><p>{error}</p><Button variant="outline" className="mt-3" onClick={load}>Retry</Button></div>}

        {loading && <div role="status" className="mb-5 text-slate-300">Loading your dashboard...</div>}

        <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-300" aria-label="Service status"><span>Backend: {services.backend}</span><span>Database: {services.database}</span><span>Gemini: {services.gemini}</span></div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Next Exam', value: daysToExam === null ? 'Not set' : daysToExam === 0 ? 'Today' : `${daysToExam} days` },
            { label: 'Daily Study Goal', value: data?.profile.profile?.preferredHours ? `${data.profile.profile.preferredHours} hrs` : 'Not set' },
            { label: 'Topics Done', value: `${data?.progress.completedTopics ?? 0}/${data?.progress.totalTopics ?? 0}` },
            { label: 'Quiz Accuracy', value: `${data?.progress.quizAccuracy ?? 0}%` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-soft">
              <div className="text-sm text-slate-400">{stat.label}</div>
              <div className="mt-3 text-3xl font-bold text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Today&apos;s plan</h2>
              <Link to="/planner" className="text-sm text-indigo-300">{todayTasks.length} tasks left · View planner</Link>
            </div>
            <div className="space-y-4">
              {todayTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div>
                    <div className="text-sm text-indigo-300">{task.scheduledAt ? new Date(task.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}{task.durationMinutes ? ` · ${task.durationMinutes} min` : ''}</div>
                    <div className="font-medium text-slate-100">{task.title}</div>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-300">{task.priority === 1 ? 'High priority' : 'Priority'}</span>
                </div>
              ))}
              {!loading && todayTasks.length === 0 && <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">No study tasks scheduled for today. Create a plan to add tasks.</p>}
              <div className="flex flex-wrap gap-3"><Link to="/planner"><Button variant="outline">View planner</Button></Link><Link to="/quiz"><Button variant="outline">Take quiz</Button></Link><Link to="/progress"><Button variant="outline">View progress</Button></Link></div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-xl font-semibold">Focus areas</h2>
            {data?.progress.weakTopics.length ? <ul className="mt-4 space-y-3">{data.progress.weakTopics.slice(0, 5).map((item) => <li key={`${item.subject}-${item.topic}`} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm"><span className="font-medium text-white">{item.topic}</span><span className="block text-slate-400">{item.subject}</span></li>)}</ul> : <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">Your saved quiz and topic data will surface focus areas here.</p>}
            <Link className="mt-4 inline-block text-sm text-indigo-300" to="/progress">View progress</Link>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Your subjects</h2><Link to="/subjects" className="text-sm text-indigo-300">View all</Link></div>
          {data?.progress.subjectCompletion.length ? <div className="grid gap-3 sm:grid-cols-2">{data.progress.subjectCompletion.slice(0, 4).map((subject) => <Link key={subject.subjectId} to={`/subjects/${subject.subjectId}`} className="rounded-xl border border-slate-800 bg-slate-950 p-4 hover:border-indigo-500"><div className="font-medium text-white">{subject.subject}</div><div className="mt-3 h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${subject.completion}%` }} /></div><div className="mt-1 text-right text-xs text-slate-400">{subject.completion}%</div></Link>)}</div> : <p className="text-sm text-slate-400">No subject progress yet. Select subjects during onboarding to begin.</p>}
        </section>
      </div>
    </div>
  );
}
