import { FormEvent, useEffect, useState } from 'react';

import { Button } from '../components/ui/button';
import { apiFetch } from '../lib/api';

type StudyTask = {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  priority: number | null;
  status: string;
  completed: boolean;
};

type StudyPlan = { id: string; title: string; examDate: string | null; days: Array<{ id: string; dayIndex: number; title: string; summary: string | null }>; tasks: StudyTask[] };
type SubjectChoice = { id: string; code: string; name: string; syllabus?: Array<{ unit: string; topics: Array<string | { id: string; name: string; completed: boolean; questionFrequency?: number }> }> };

export function PlannerPage() {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [subjects, setSubjects] = useState<SubjectChoice[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [examDate, setExamDate] = useState('');
  const [dailyHours, setDailyHours] = useState(3);
  const [topicsText, setTopicsText] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [rescheduleDates, setRescheduleDates] = useState<Record<string, string>>({});

  const loadPlan = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch<{ current: StudyPlan | null }>('/planner');
      setPlan(response.current);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your study plan.');
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    try {
      const response = await apiFetch<{ subjects: SubjectChoice[] }>('/subjects');
      setSubjects(response.subjects);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load local subjects.');
    }
  };

  useEffect(() => {
    loadPlan();
    loadSubjects();
  }, []);

  const selectedSubject = subjects.find((item) => item.id === subjectId);
  const syllabusTopics = selectedSubject?.syllabus?.flatMap((unit) => unit.topics.map((topic) => typeof topic === 'string'
    ? { name: topic, unit: unit.unit, frequency: 0 }
    : { name: topic.name, unit: unit.unit, frequency: topic.questionFrequency ?? 0 })) ?? [];

  const generatePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const topics = syllabusTopics.length ? selectedTopics : topicsText.split(',').map((topic) => topic.trim()).filter(Boolean);
    if (!topics.length) {
      setError('Add at least one topic to generate a study plan.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const days = Math.max(1, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000));
      const response = await apiFetch<StudyPlan>('/planner/generate', {
        method: 'POST',
        body: JSON.stringify({ subject: selectedSubject?.name ?? subjectId.trim(), examDate, availableDays: days, dailyHours, topics }),
      });
      setPlan(response);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create your plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const generateAiPlan = async () => {
    const topics = syllabusTopics.length ? selectedTopics : topicsText.split(',').map((topic) => topic.trim()).filter(Boolean);
    if (!subjectId || !examDate || !topics.length) {
      setError('Choose a subject, exam date, and at least one local syllabus topic for an AI plan.');
      return;
    }
    setAiSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await apiFetch<StudyPlan & { recommendationDisclaimer: string }>('/ai/study-plan', {
        method: 'POST',
        body: JSON.stringify({ subject: subjectId, examDate, availableHours: dailyHours, priorityTopics: topics }),
      });
      setPlan(response);
      setSuccessMessage(response.recommendationDisclaimer);
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : 'Unable to generate an AI study recommendation.');
    } finally {
      setAiSaving(false);
    }
  };

  const updateTask = async (task: StudyTask, action: 'complete' | 'skip' | 'reschedule') => {
    const scheduledAt = rescheduleDates[task.id];
    if (action === 'reschedule' && !scheduledAt) {
      setError('Choose a new date before rescheduling.');
      return;
    }
    setError('');
    try {
      const updated = await apiFetch<StudyTask>(`/planner/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, ...(action === 'reschedule' ? { scheduledAt } : {}) }),
      });
      setPlan((current) => current ? { ...current, tasks: current.tasks.map((item) => item.id === updated.id ? updated : item) } : current);
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : 'Unable to update this task.');
    }
  };

  const replan = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch<{ tasks: StudyTask[] }>('/planner/replan', { method: 'POST', body: JSON.stringify({}) });
      setPlan((current) => current ? { ...current, tasks: current.tasks.map((task) => response.tasks.find((item) => item.id === task.id) ?? task) } : current);
    } catch (replanError) {
      setError(replanError instanceof Error ? replanError.message : 'Unable to replan your remaining tasks.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    setError('');
    try {
      await apiFetch(`/planner/tasks/${taskId}`, { method: 'DELETE' });
      setPlan((current) => current ? { ...current, tasks: current.tasks.filter((task) => task.id !== taskId) } : current);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this task.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm text-slate-400">Smart study sequence</p><h1 className="text-3xl font-bold text-white">Study Planner</h1></div>
          {plan && <Button variant="outline" onClick={replan} disabled={saving}>{saving ? 'Replanning...' : 'Replan remaining tasks'}</Button>}
        </header>

        <form onSubmit={generatePlan} className="mb-8 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:grid-cols-2">
          <label className="block"><span className="mb-2 block text-sm text-slate-300">Subject</span>{subjects.length ? <select required value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setSelectedTopics([]); }} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100"><option value="">Choose a local subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select> : <input required value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" placeholder="Enter a subject" />}</label>
          <label className="block"><span className="mb-2 block text-sm text-slate-300">Exam date</span><input required type="date" min={new Date().toISOString().slice(0, 10)} value={examDate} onChange={(event) => setExamDate(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" /></label>
          <label className="block"><span className="mb-2 block text-sm text-slate-300">Available hours per day</span><input required type="number" min={1} max={12} value={dailyHours} onChange={(event) => setDailyHours(Number(event.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" /></label>
          {syllabusTopics.length ? <fieldset className="space-y-3 md:col-span-2"><legend className="mb-2 text-sm text-slate-300">Select syllabus topics (ordered by local question frequency)</legend>{selectedSubject?.syllabus?.map((unit) => <div key={unit.unit} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><h3 className="mb-2 text-sm font-medium text-white">{unit.unit}</h3><div className="grid gap-2 sm:grid-cols-2">{unit.topics.map((topic) => { const item = typeof topic === 'string' ? { name: topic, questionFrequency: 0 } : topic; return <label key={item.name} className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={selectedTopics.includes(item.name)} onChange={() => setSelectedTopics((current) => current.includes(item.name) ? current.filter((name) => name !== item.name) : [...current, item.name])} className="accent-indigo-500" /><span>{item.name}</span><span className="ml-auto text-xs text-slate-500">PYQ {item.questionFrequency ?? 0}</span></label>; })}</div></div>)}</fieldset> : <label className="block md:col-span-2"><span className="mb-2 block text-sm text-slate-300">Topics, comma-separated</span><textarea required rows={3} value={topicsText} onChange={(event) => setTopicsText(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" placeholder="Enter the topics you need to study" /></label>}
          <div className="flex flex-wrap gap-3 md:col-span-2"><Button type="submit" disabled={saving || aiSaving}>{saving ? 'Creating your study plan...' : 'Generate study plan'}</Button><Button type="button" variant="outline" disabled={saving || aiSaving} onClick={generateAiPlan}>{aiSaving ? 'Generating AI recommendation...' : 'Generate AI study recommendation'}</Button></div>
        </form>

        {successMessage && <p role="status" className="mb-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-indigo-100">{successMessage}</p>}
        {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100"><p>{error}</p><Button variant="outline" className="mt-3" onClick={loadPlan}>Retry loading saved plan</Button></div>}
        {loading ? <div role="status" className="text-slate-300">Loading your saved plan...</div> : !plan ? <div className="rounded-xl border border-slate-800 p-5 text-slate-400">No study plan yet. Enter your exam date and topics to build one.</div> : (
          <section aria-label="Saved study plan" className="space-y-4">
            <h2 className="text-xl font-semibold text-white">{plan.title}</h2>
            {plan.tasks.map((task) => (
              <article key={task.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-semibold text-white">{task.title}</h3><p className="mt-1 text-sm text-slate-400">{task.scheduledAt ? new Date(task.scheduledAt).toLocaleDateString() : 'Unscheduled'} · {task.durationMinutes ?? '—'} min · {task.priority === 1 ? 'High priority' : 'Priority'}</p>{task.description && <p className="mt-2 text-sm text-slate-300">{task.description}</p>}</div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{task.status}</span>
                </div>
                {task.status !== 'completed' && <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => updateTask(task, 'complete')}>Complete</Button>
                  <Button size="sm" variant="outline" onClick={() => updateTask(task, 'skip')}>Skip</Button>
                  <Button size="sm" variant="outline" onClick={() => deleteTask(task.id)}>Delete</Button>
                  <input aria-label={`New date for ${task.title}`} type="date" min={new Date().toISOString().slice(0, 10)} value={rescheduleDates[task.id] ?? ''} onChange={(event) => setRescheduleDates((dates) => ({ ...dates, [task.id]: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                  <Button size="sm" variant="outline" onClick={() => updateTask(task, 'reschedule')}>Reschedule</Button>
                </div>}
              </article>
            ))}
            {!plan.tasks.length && <p className="text-slate-400">This plan has no tasks.</p>}
          </section>
        )}
      </div>
    </div>
  );
}
