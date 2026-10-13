import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/button';
import { apiFetch, saveSession } from '../lib/api';

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'register'>(location.pathname === '/register' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(location.pathname === '/register' ? 'register' : 'login');
  }, [location.pathname]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = mode === 'register'
        ? { name, email, password }
        : { email, password };

      const response = await apiFetch<{ token: string; user: { id: string; email: string; name: string }; onboardingComplete: boolean }>(`/auth/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      saveSession(response.token, response.user);
      navigate(response.onboardingComplete ? '/dashboard' : '/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-soft backdrop-blur-xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Smart Exam Planner</p>
            <h1 className="mt-2 text-2xl font-bold text-white">{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-lg font-bold text-indigo-300">S</div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/70 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-xl px-3 py-2 text-sm font-medium ${mode === 'login' ? 'bg-indigo-500 text-white' : 'text-slate-300'}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`rounded-xl px-3 py-2 text-sm font-medium ${mode === 'register' ? 'bg-indigo-500 text-white' : 'text-slate-300'}`}
          >
            Register
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Full name</span>
              <input autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100 outline-none ring-0 placeholder:text-slate-500" placeholder="Your name" />
            </label>
          )}

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Email</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100 outline-none placeholder:text-slate-500" placeholder="you@college.edu" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Password</span>
            <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100 outline-none placeholder:text-slate-500" placeholder="At least 6 characters" />
          </label>

          {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

          <Button className="w-full" size="lg" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          By continuing, you agree to our academic planning terms and data usage policy.
        </div>
      </div>
    </div>
  );
}
