import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './layouts/AppLayout';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { AcademicImportPage } from './pages/AcademicImportPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';
import { NotesPage } from './pages/NotesPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PlannerPage } from './pages/PlannerPage';
import { ProgressPage } from './pages/ProgressPage';
import { QuizPage } from './pages/QuizPage';
import { SubjectDetailPage } from './pages/SubjectDetailPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { apiFetch, clearSession, getStoredToken } from './lib/api';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    let active = true;
    if (!getStoredToken()) {
      setValidating(false);
      return;
    }
    apiFetch('/auth/me')
      .then(() => active && setValid(true))
      .catch(() => {
        clearSession();
        if (active) setValid(false);
      })
      .finally(() => active && setValidating(false));
    return () => { active = false; };
  }, []);

  if (validating) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">Checking your session...</div>;
  if (!valid) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />
      <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />

      <Route path="/dashboard" element={<RequireAuth><AppLayout><DashboardPage /></AppLayout></RequireAuth>} />
      <Route path="/subjects" element={<RequireAuth><AppLayout><SubjectsPage /></AppLayout></RequireAuth>} />
      <Route path="/subjects/:id" element={<RequireAuth><AppLayout><SubjectDetailPage /></AppLayout></RequireAuth>} />
      <Route path="/planner" element={<RequireAuth><AppLayout><PlannerPage /></AppLayout></RequireAuth>} />
      <Route path="/quiz" element={<RequireAuth><AppLayout><QuizPage /></AppLayout></RequireAuth>} />
      <Route path="/analysis" element={<RequireAuth><AppLayout><AnalysisPage /></AppLayout></RequireAuth>} />
      <Route path="/progress" element={<RequireAuth><AppLayout><ProgressPage /></AppLayout></RequireAuth>} />
      <Route path="/notes" element={<RequireAuth><AppLayout><NotesPage /></AppLayout></RequireAuth>} />
      <Route path="/ai" element={<RequireAuth><AppLayout><AiAssistantPage /></AppLayout></RequireAuth>} />
      <Route path="/ai-assistant" element={<RequireAuth><AppLayout><AiAssistantPage /></AppLayout></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><AppLayout><SettingsPage /></AppLayout></RequireAuth>} />
      <Route path="/import" element={<RequireAuth><AppLayout><AcademicImportPage /></AppLayout></RequireAuth>} />
      <Route path="/admin/import" element={<RequireAuth><AppLayout><AcademicImportPage /></AppLayout></RequireAuth>} />

      <Route path="*" element={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100"><div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center"><h1 className="text-2xl font-bold">Page not found</h1><p className="mt-2 text-slate-400">The page you are looking for does not exist.</p><Link to="/" className="mt-5 inline-block text-indigo-300">Return home</Link></div></div>} />
    </Routes>
  );
}

export default App;
