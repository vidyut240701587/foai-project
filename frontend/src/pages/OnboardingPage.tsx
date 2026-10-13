import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/button';
import { apiFetch } from '../lib/api';

const departments = ['CSE', 'ECE', 'EEE', 'MECH', 'IT'];
const semesters = ['III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const levels = ['Not Started', 'Beginner', 'Intermediate', 'Almost Ready'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [department, setDepartment] = useState('CSE');
  const [semester, setSemester] = useState('VI');
  const [availableSubjects, setAvailableSubjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState('');
  const [examDates, setExamDates] = useState(['']);
  const [dailyStudyHours, setDailyStudyHours] = useState(4);
  const [preparationLevel, setPreparationLevel] = useState('Intermediate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const progress = (step / 6) * 100;

  const loadSubjects = async () => {
    try {
      const response = await apiFetch<{ subjects: Array<{ id: string; name: string; code: string }> }>('/subjects');
      setAvailableSubjects(response.subjects);
    } catch {
      setAvailableSubjects([]);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) => prev.includes(subject) ? prev.filter((item) => item !== subject) : [...prev, subject]);
  };

  const addSubject = () => {
    const subject = subjectInput.trim();
    if (!subject || selectedSubjects.includes(subject)) return;
    setSelectedSubjects((prev) => [...prev, subject]);
    setSubjectInput('');
  };

  const submit = async () => {
    setLoading(true);
    setError('');

    try {
      await apiFetch('/auth/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          department,
          semester,
          subjects: selectedSubjects,
          examDates,
          dailyStudyHours,
          preparationLevel,
        }),
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save onboarding details');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Choose your department</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {departments.map((item) => (
                <button key={item} type="button" onClick={() => setDepartment(item)} className={`rounded-2xl border p-4 text-left text-slate-100 ${department === item ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-950 hover:border-indigo-500'}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Choose your semester</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {semesters.map((item) => (
                <button key={item} type="button" onClick={() => setSemester(item)} className={`rounded-2xl border p-4 text-slate-100 ${semester === item ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-950 hover:border-indigo-500'}`}>
                  Semester {item}
                </button>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Select your subjects</h2>
            <div className="space-y-3">
              {availableSubjects.map((item) => (
                <label key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-slate-100">
                  <input type="checkbox" checked={selectedSubjects.includes(item.name)} onChange={() => toggleSubject(item.name)} className="h-4 w-4 accent-indigo-500" />
                  <span>{item.code} · {item.name}</span>
                </label>
              ))}
              {selectedSubjects.filter((name) => !availableSubjects.some((item) => item.name === name)).map((subject) => (
                <label key={subject} className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-slate-100">
                  <input type="checkbox" checked={selectedSubjects.includes(subject)} onChange={() => toggleSubject(subject)} className="h-4 w-4 accent-indigo-500" />
                  <span>{subject}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={subjectInput} onChange={(event) => setSubjectInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSubject(); } }} aria-label="Subject name" placeholder="Add a subject" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" />
              <Button type="button" variant="outline" onClick={addSubject}>Add</Button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Enter exam dates</h2>
            <div className="space-y-3">
              <input type="date" value={examDates[0] ?? ''} onChange={(e) => setExamDates([e.target.value])} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" />
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Daily available study hours</h2>
            <input type="number" min={1} max={12} value={dailyStudyHours} onChange={(e) => setDailyStudyHours(Number(e.target.value || 1))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" />
          </div>
        );
      case 6:
        return (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Current preparation level</h2>
            <div className="grid gap-3">
              {levels.map((item) => (
                <button key={item} type="button" onClick={() => setPreparationLevel(item)} className={`rounded-2xl border p-4 text-left text-slate-100 ${preparationLevel === item ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-950 hover:border-indigo-500'}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-soft">
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between text-sm text-slate-400">
            <span>Step {step} of 6</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {renderStep()}

        {error && <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

        <div className="mt-8 flex justify-between gap-3">
          <Button variant="outline" onClick={() => setStep((prev) => Math.max(1, prev - 1))}>
            Back
          </Button>
          {step < 6 ? (
            <Button onClick={() => {
              if (step === 3 && selectedSubjects.length === 0) {
                setError('Select or add at least one subject to continue.');
                return;
              }
              if (step === 4 && !examDates[0]) {
                setError('Enter your next exam date to continue.');
                return;
              }
              setError('');
              setStep((prev) => Math.min(6, prev + 1));
            }}>
              Continue
            </Button>
          ) : (
            <Button onClick={submit} disabled={loading}>
              {loading ? 'Saving...' : 'Generate dashboard'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
