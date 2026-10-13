import { ArrowRight, BrainCircuit, CalendarCheck2, FileText, Gauge, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { apiFetch } from '../lib/api';

const features = [
  { icon: BrainCircuit, title: 'AI topic analysis', description: 'Identify repeated concepts from historical question papers and marks weightage.' },
  { icon: FileText, title: 'Multiple paper upload', description: 'Upload several previous-year question papers and analyze them together for top recurring topics.' },
  { icon: CalendarCheck2, title: 'Daily planner', description: 'Create realistic day-wise plans based on remaining syllabus and exam dates.' },
  { icon: Gauge, title: 'Progress-aware', description: 'Track quiz accuracy, weak topics and revision frequency over time.' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [services, setServices] = useState<{ database: string; ai: string }>({ database: 'checking', ai: 'checking' });

  useEffect(() => {
    apiFetch<{ status: string; services: { database: { status: string }; ai: { status: string } } }>('/health')
      .then((health) => {
        setBackendConnected(health.status === 'healthy');
        setServices({ database: health.services.database.status, ai: health.services.ai.status });
      })
      .catch(() => {
        setBackendConnected(false);
        setServices({ database: 'unavailable', ai: 'unavailable' });
      });
  }, []);

  const getStarted = async () => {
    const token = localStorage.getItem('smart_exam_token');
    if (!token) {
      navigate('/register');
      return;
    }

    try {
      const response = await apiFetch<{ onboardingComplete: boolean }>('/auth/profile');
      navigate(response.onboardingComplete ? '/dashboard' : '/onboarding');
    } catch {
      navigate('/login');
    }
  };

  const exploreFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-lg font-bold text-indigo-300">S</div>
          <div>
            <div className="text-xs font-semibold tracking-[0.2em] text-indigo-300">SMART EXAM PLANNER</div>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          <a href="#features">Features</a>
        </nav>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/login')}>Login</Button>
          <Button size="sm" onClick={getStarted}>Get Started</Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-20 pt-10">
        <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
              <Sparkles size={14} /> Academic planning for your courses
            </div>
            <h1 className="max-w-xl text-5xl font-black tracking-tight text-white md:text-6xl">
              Study smarter.<br />Prepare with data.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              Organize your subjects, build a study plan, practice quizzes, and track your progress in one workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button size="lg" onClick={getStarted}>Get Started <ArrowRight className="ml-2" size={16} /></Button>
              <Button variant="outline" size="lg" onClick={exploreFeatures}>Explore Features</Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-400"><span>Subject tracking</span><span>Personal study plans</span><span>Progress from your saved work</span></div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-soft">
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-200"><Gauge size={20} /></div><div><p className="text-sm text-slate-400">Live backend checks</p><h2 className="font-semibold text-white">Service status</h2></div></div>
            <div className="mt-6 divide-y divide-slate-800">
              <div className="flex items-center justify-between py-4"><span className="text-slate-200">Backend</span><span className={`rounded-full border px-3 py-1 text-xs ${backendConnected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : backendConnected === false ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-slate-700 text-slate-300'}`}>{backendConnected === null ? 'Checking' : backendConnected ? 'Backend Connected' : 'Backend Offline'}</span></div>
              {Object.entries({ Database: services.database, Gemini: services.ai }).map(([name, status]) => <div key={name} className="flex items-center justify-between py-4"><span className="text-slate-200">{name}</span><span className={`rounded-full border px-3 py-1 text-xs ${status === 'ok' || status === 'configured' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>{status === 'ok' ? 'Available' : status === 'configured' ? 'Configured' : status === 'checking' ? 'Checking' : status === 'not_configured' ? 'Not configured' : 'Unavailable'}</span></div>)}
            </div>
            <p className="mt-4 text-sm text-slate-400">Unavailable services are reported as-is; no sample academic records are used.</p>
          </div>
        </section>

        <section id="features" className="mt-24">
          <div className="mb-8 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-indigo-300">Features</p>
            <h2 className="mt-3 text-3xl font-bold text-white">Built for serious academic planning</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="p-5">
                <div className="mb-4 inline-flex rounded-xl bg-indigo-500/10 p-3 text-indigo-200">
                  <Icon size={20} />
                </div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm text-slate-400">{description}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
