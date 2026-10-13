import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Clock3, Sparkles } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { apiFetch } from '../lib/api';

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  topic: string;
  difficulty: string;
  marks: number;
};

type QuizResult = {
  score: number;
  total: number;
  accuracy: number;
  correctAnswers: number;
  wrongAnswers: number;
  weakTopics: string[];
  results: Array<{ questionId: string; topic: string; selectedAnswer: string; correctAnswer: string; correct: boolean; explanation: string | null }>;
};

type QuizHistory = { score: number; total: number; accuracy: number | null; quiz: { title: string } };

export function QuizPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ subject: '', topic: '', difficulty: 'Medium', count: 5 });
  const [subjects, setSubjects] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [history, setHistory] = useState<QuizHistory[]>([]);
  const [quizId, setQuizId] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');

  const loadData = async () => {
    try {
      const [subjectsResponse, historyResponse] = await Promise.all([
        apiFetch<{ subjects: Array<{ id: string; code: string; name: string }> }>('/subjects'),
        apiFetch<{ history: QuizHistory[] }>('/quiz/history'),
      ]);
      setSubjects(subjectsResponse.subjects);
      setHistory(historyResponse.history);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to load quiz data. Please retry.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const generateQuiz = async () => {
    if (!form.subject.trim() || !form.topic.trim()) {
      setPageError('Enter a subject and topic before generating a quiz.');
      return;
    }
    setLoading(true);
    setPageError('');
    try {
      const payload = await apiFetch<{ quizId: string; questions: QuizQuestion[] }>('/quiz/generate', {
        method: 'POST',
        body: JSON.stringify({
          subject: form.subject,
          topic: form.topic,
          difficulty: form.difficulty,
          count: Number(form.count),
        }),
      });
      setQuizId(payload.quizId);
      setQuestions(payload.questions || []);
      setCurrentIndex(0);
      setAnswers({});
      setResult(null);
      if (!payload.questions.length) setPageError('The quiz service returned no questions. Please retry.');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to generate a quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = questions[currentIndex];
  const selected = currentQuestion ? answers[currentQuestion.id] : undefined;

  const handleAnswer = (option: string) => {
    if (!currentQuestion || result) return;
    setAnswers((previous) => ({ ...previous, [currentQuestion.id]: option }));
  };

  const submitQuiz = async () => {
    if (!quizId || questions.some((question) => !answers[question.id])) {
      setPageError('Answer every question before submitting.');
      return;
    }
    setLoading(true);
    setPageError('');
    try {
      const submitted = await apiFetch<QuizResult>(`/quiz/${quizId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: questions.map((question) => ({ questionId: question.id, answer: answers[question.id] })) }),
      });
      setResult(submitted);
      await loadData();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to submit the quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const chartData = history.slice(0, 8).reverse().map((attempt, index) => ({ name: `Quiz ${index + 1}`, accuracy: attempt.accuracy ?? Math.round((attempt.score / attempt.total) * 100) }));

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-indigo-300">AI Quiz</p>
            <h1 className="text-3xl font-bold text-white">Generate a focused practice test</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
            <Clock3 size={16} />
            15 min
          </div>
        </header>

        <div className="mb-8 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2 text-indigo-200">
              <Sparkles size={18} />
              <span className="font-medium">Quiz configuration</span>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Subject</span>
                {subjects.length ? <select required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100"><option value="">Select a saved subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.name}>{subject.code} · {subject.name}</option>)}</select> : <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" placeholder="Enter a subject" />}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Topic</span>
                <input required value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" placeholder="Enter a topic" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Difficulty</span>
                  <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100">
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Questions</span>
                  <input type="number" min={1} max={10} value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" />
                </label>
              </div>

              <Button className="w-full" onClick={generateQuiz} disabled={loading}>
                {loading ? 'Generating...' : 'Generate quiz'}
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-200">
                <BarChart3 size={18} />
                <span className="font-medium">Performance</span>
              </div>
              <span className="text-sm text-indigo-300">Accuracy trend</span>
            </div>
            <div className="h-52">
              {chartData.length > 0 ? <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="accuracy" fill="#6366f1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer> : <p className="pt-16 text-center text-sm text-slate-400">Complete a quiz to see your accuracy history.</p>}
            </div>
          </Card>
        </div>

        {pageError && <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100"><p>{pageError}</p><Button variant="outline" className="mt-3" onClick={loadData}>Retry</Button></div>}

        {result ? (
          <Card className="p-6">
            <p className="text-sm uppercase text-indigo-300">Quiz result</p>
            <h2 className="mt-2 text-3xl font-bold text-white">{result.score} / {result.total}</h2>
            <p className="mt-2 text-slate-300">{result.correctAnswers} correct · {result.wrongAnswers} wrong · {result.accuracy}% accuracy</p>
            <div className="mt-6 space-y-3">{result.results.map((answer) => <div key={answer.questionId} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className={answer.correct ? 'text-emerald-300' : 'text-red-300'}>{answer.topic}: {answer.correct ? 'Correct' : 'Review this answer'}</div><p className="mt-1 text-sm text-slate-300">Correct answer: {answer.correctAnswer}</p>{answer.explanation && <p className="mt-1 text-sm text-slate-400">{answer.explanation}</p>}</div>)}</div>
            {result.weakTopics.length > 0 && <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><h3 className="font-semibold text-amber-100">Topics to review</h3><p className="mt-2 text-sm text-amber-50">{result.weakTopics.join(', ')}</p></div>}
            <div className="mt-6 flex flex-wrap gap-3"><Button onClick={generateQuiz} disabled={loading}>{loading ? 'Generating...' : 'Retry quiz'}</Button><Button variant="outline" onClick={() => navigate('/planner')}>Study weak topics</Button><Button variant="outline" onClick={() => navigate('/dashboard')}>Back to dashboard</Button></div>
          </Card>
        ) : questions.length > 0 && currentQuestion && (
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-slate-400">Question {currentIndex + 1} / {questions.length}</div>
              <div className="rounded-full bg-indigo-500/10 px-3 py-1 text-sm text-indigo-200">{currentQuestion.topic}</div>
            </div>

            <div className="mb-6 h-2 rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
            </div>

            <h2 className="text-2xl font-semibold text-white">{currentQuestion.question}</h2>

            <div className="mt-6 grid gap-3">
              {currentQuestion.options.map((option) => {
                const isSelected = option === selected;
                const className = isSelected ? 'border-indigo-500 bg-indigo-500/10 text-indigo-100' : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-indigo-500';

                return (
                  <button key={option} type="button" onClick={() => handleAnswer(option)} className={`rounded-2xl border p-4 text-left ${className}`}>
                    {option}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 text-xs text-slate-400">Topic: {currentQuestion.topic} · Difficulty: {currentQuestion.difficulty} · Marks: {currentQuestion.marks}</div>

            <div className="mt-6 flex justify-between">
              <div className="flex gap-2"><Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => index - 1)}>Previous</Button><Button variant="outline" disabled={!selected || currentIndex >= questions.length - 1} onClick={() => setCurrentIndex((index) => index + 1)}>Next question</Button></div>
              <Button onClick={submitQuiz} disabled={loading || Object.keys(answers).length < questions.length}>{loading ? 'Submitting...' : 'Submit quiz'}</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
