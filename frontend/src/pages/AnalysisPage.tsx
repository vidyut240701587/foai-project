import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BrainCircuit, CheckCircle2, Download, FileText, RefreshCcw, Sparkles, UploadCloud } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { apiFetch } from '../lib/api';

type UploadedFileItem = {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  status: 'ready' | 'uploading' | 'done' | 'error';
};

type TopicInsight = {
  topic: string;
  unit: string;
  frequency: number;
  marks: number[];
  priority: string;
  confidence: number;
};

type PredictionItem = {
  question: string;
  topic: string;
  unit: string;
  frequency: number;
  confidence: number;
  reason: string;
};

type AnalysisResult = {
  subject: string;
  papersAnalyzed: number;
  questionsAnalyzed: number;
  uniqueTopics: number;
  repeatedTopics: number;
  topics: TopicInsight[];
  repeatedTopicsList: TopicInsight[];
  marksDistribution: Array<{ marks: number; count: number }>;
  predicted2MarkQuestions: PredictionItem[];
  predicted11MarkQuestions: PredictionItem[];
  highPriorityTopics: TopicInsight[];
  disclaimer: string;
};

type SubjectChoice = { id: string; code: string; name: string };

const fileTypeLabel = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'PDF';
  if (extension === 'docx') return 'DOCX';
  if (extension === 'txt') return 'TXT';
  if (extension === 'json') return 'JSON';
  if (extension === 'csv') return 'CSV';
  return file.type || 'FILE';
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function AnalysisPage() {
  const [searchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [subjects, setSubjects] = useState<SubjectChoice[]>([]);
  const [subjectId, setSubjectId] = useState(searchParams.get('subjectId') ?? '');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [examType, setExamType] = useState('CAT1');
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState('Ready');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quizNotice, setQuizNotice] = useState('');
  const [planNotice, setPlanNotice] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<{ subjects: SubjectChoice[] }>('/subjects')
      .then(({ subjects: choices }) => {
        if (!active) return;
        setSubjects(choices);
        setSubjectId((current) => choices.some((subject) => subject.id === current) ? current : choices[0]?.id ?? '');
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load your subjects.');
      });
    return () => { active = false; };
  }, []);

  const addFiles = (incoming: FileList | File[]) => {
    const supportedFiles = Array.from(incoming).filter((file) => /\.(pdf|docx|txt)$/i.test(file.name) && file.size > 0 && file.size <= 15 * 1024 * 1024);
    if (supportedFiles.length !== incoming.length) {
      setError('Choose non-empty PDF, DOCX, or TXT files no larger than 15 MB each.');
    }
    const nextFiles = supportedFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      name: file.name,
      type: fileTypeLabel(file),
      size: file.size,
      status: 'ready' as const,
    }));

    setFiles((current) => [...current, ...nextFiles].slice(0, 5));
    if (files.length + nextFiles.length > 5) setError('Select no more than five question papers per analysis.');
  };

  const runAnalysis = async () => {
    if (files.length < 2) {
      setError('Upload at least two previous-year question papers before running the analysis.');
      return;
    }
    if (!subjectId || !year || !examType) {
      setError('Select your subject, exam year, and exam type before analyzing papers.');
      return;
    }

    setLoading(true);
    setError('');
    setProgress('Uploading...');
    setFiles((current) => current.map((entry) => ({ ...entry, status: 'uploading' })));

    try {
      const formData = new FormData();
      files.forEach(({ file }) => formData.append('files', file));
      formData.set('subjectId', subjectId);
      formData.set('year', year);
      formData.set('examType', examType);

      const response = await apiFetch<{ analysis: AnalysisResult; uploadedPapers: Array<{ filename: string }> }>('/analysis/upload', {
        method: 'POST',
        body: formData,
      });

      setProgress('Extracting questions...');
      setFiles((current) => current.map((entry) => ({ ...entry, status: 'done' })));
      setAnalysis(response.analysis);
      setQuizNotice('');
      setPlanNotice('');
    } catch (analysisError) {
      setFiles((current) => current.map((entry) => ({ ...entry, status: 'error' })));
      setError(analysisError instanceof Error ? analysisError.message : 'Unable to analyze the uploaded papers.');
    } finally {
      setLoading(false);
    }
  };

  const generateQuiz = async () => {
    if (!analysis) {
      setError('Run the analysis first to generate a quiz from the repeated topics.');
      return;
    }
    if (!analysis.highPriorityTopics.length) {
      setError('No repeated syllabus-matched topics were found, so a quiz cannot be generated from this analysis.');
      return;
    }

    try {
      const preferredTopic = analysis.highPriorityTopics[0].topic;
      const payload = {
        subject: analysis.subject,
        topic: preferredTopic,
        difficulty: 'Medium',
        marks: 2,
        count: 5,
      };
      const result = await apiFetch<{ quizId: string; questions: Array<Record<string, unknown>> }>('/quiz/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setQuizNotice(`Quiz generated with ${result.questions.length} questions based on ${preferredTopic}.`);
    } catch (quizError) {
      setError(quizError instanceof Error ? quizError.message : 'Unable to generate the quiz.');
    }
  };

  const createStudyPlan = async () => {
    if (!analysis) {
      setError('Run the analysis first to create a study plan based on high-priority topics.');
      return;
    }
    if (!analysis.highPriorityTopics.length) {
      setError('No repeated syllabus-matched topics were found, so a study plan cannot be generated from this analysis.');
      return;
    }

    try {
      const priorityTopics = analysis.highPriorityTopics.map((entry) => entry.topic);
      const payload = {
        subject: analysis.subject,
        examDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
        availableHours: 3,
        priorityTopics,
      };
      const result = await apiFetch<{ title?: string; tasks?: Array<Record<string, unknown>> }>('/ai/study-plan', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPlanNotice(`Study plan created with ${result.tasks?.length ?? priorityTopics.length} planned tasks.`);
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : 'Unable to generate the study plan.');
    }
  };

  const exportReport = () => {
    if (!analysis) {
      setError('Analyze the uploaded papers before exporting the report.');
      return;
    }

    const payload = {
      subject: analysis.subject,
      papersAnalyzed: analysis.papersAnalyzed,
      questionsAnalyzed: analysis.questionsAnalyzed,
      uniqueTopics: analysis.uniqueTopics,
      repeatedTopics: analysis.repeatedTopics,
      topicFrequency: analysis.topics.map((topic) => ({ topic: topic.topic, unit: topic.unit, frequency: topic.frequency, priority: topic.priority, confidence: topic.confidence })),
      repeatedTopicsList: analysis.repeatedTopicsList,
      marksDistribution: analysis.marksDistribution,
      predicted2MarkQuestions: analysis.predicted2MarkQuestions,
      predicted11MarkQuestions: analysis.predicted11MarkQuestions,
      disclaimer: analysis.disclaimer,
      uploadedFiles: files.map((entry) => ({ name: entry.name, type: entry.type, size: entry.size })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${analysis.subject.replace(/\s+/g, '-').toLowerCase()}-analysis-report.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const topicChartData = (analysis?.topics ?? []).slice(0, 8).map((topic) => ({
    name: topic.topic.length > 16 ? `${topic.topic.slice(0, 16)}…` : topic.topic,
    frequency: topic.frequency,
  }));

  const marksChartData = (analysis?.marksDistribution ?? []).map((entry) => ({
    name: `${entry.marks} Marks`,
    count: entry.count,
  }));

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">AI paper analysis</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Analysis</h1>
          </div>
          <div className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100">
            {progress}
          </div>
        </header>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Unable to complete the workflow</p>
              <p className="mt-1 text-sm text-red-200">{error}</p>
            </div>
          </div>
        )}

        <Card className="overflow-hidden border border-slate-800 bg-slate-900/80 p-0">
          <div className="border-b border-slate-800 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-200">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Upload Previous-Year Question Papers</h2>
                <p className="text-sm text-slate-400">Supported formats: PDF • DOCX • TXT · 15 MB maximum per file · five files per analysis</p>
              </div>
            </div>
          </div>

          <div
            className="p-5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (event.dataTransfer.files) addFiles(event.dataTransfer.files);
            }}
          >
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-indigo-200">
                <FileText className="h-8 w-8" />
              </div>
              <p className="mt-5 text-lg font-medium text-white">Drag and drop files here</p>
              <p className="mt-2 text-sm text-slate-400">or</p>
              <Button className="mt-4" onClick={() => inputRef.current?.click()}>
                Choose Files
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(event) => {
                  if (event.target.files) addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </div>
          </div>
        </Card>

        <section aria-label="Analysis settings" className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:grid-cols-3">
          <label className="text-sm text-slate-300">
            Subject
            <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} disabled={!subjects.length} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100">
              <option value="">{subjects.length ? 'Select a subject' : 'No saved subjects available'}</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} · {subject.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Exam year
            <input type="number" required min={1900} max={2200} value={year} onChange={(event) => setYear(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" />
          </label>
          <label className="text-sm text-slate-300">
            Exam type
            <select value={examType} onChange={(event) => setExamType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100">
              <option value="CAT1">CAT1</option>
              <option value="CAT2">CAT2</option>
              <option value="Semester">Semester</option>
            </select>
          </label>
        </section>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">Uploaded Files</h3>
            <span className="text-sm text-slate-400">{files.length} selected</span>
          </div>
          {files.length ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
              <div className="grid grid-cols-[1.3fr_0.6fr_0.5fr_0.8fr] gap-3 bg-slate-950 px-4 py-3 text-xs uppercase tracking-[0.15em] text-slate-400">
                <span>File Name</span>
                <span>File Type</span>
                <span>File Size</span>
                <span>Processing Status</span>
              </div>
              {files.map((file) => (
                <div key={file.id} className="grid grid-cols-[1.3fr_0.6fr_0.5fr_0.8fr] gap-3 border-t border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-200">
                  <span className="truncate font-medium text-white">{file.name}</span>
                  <span>{file.type}</span>
                  <span>{formatBytes(file.size)}</span>
                  <span className={file.status === 'error' ? 'text-red-300' : file.status === 'done' ? 'text-emerald-300' : 'text-amber-200'}>
                    {file.status === 'uploading' ? 'Uploading...' : file.status === 'done' ? 'Ready' : file.status === 'error' ? 'Error' : 'Ready'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-slate-400">No files selected yet.</p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={runAnalysis} disabled={loading || files.length < 2 || !subjectId}>
              {loading ? 'Analyzing...' : 'Analyze All Papers'}
            </Button>
            <Button variant="outline" onClick={() => setFiles([])} disabled={loading}>
              Clear Files
            </Button>
          </div>
        </Card>

        {analysis && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="p-5">
                <p className="text-sm text-slate-400">Papers Analyzed</p>
                <p className="mt-3 text-3xl font-bold text-white">{analysis.papersAnalyzed}</p>
              </Card>
              <Card className="p-5">
                <p className="text-sm text-slate-400">Questions Analyzed</p>
                <p className="mt-3 text-3xl font-bold text-white">{analysis.questionsAnalyzed}</p>
              </Card>
              <Card className="p-5">
                <p className="text-sm text-slate-400">Unique Topics</p>
                <p className="mt-3 text-3xl font-bold text-white">{analysis.uniqueTopics}</p>
              </Card>
              <Card className="p-5">
                <p className="text-sm text-slate-400">Repeated Topics</p>
                <p className="mt-3 text-3xl font-bold text-white">{analysis.repeatedTopics}</p>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-indigo-300" />
                  <h3 className="text-lg font-semibold text-white">Topic Frequency</h3>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topicChartData}>
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                      <XAxis dataKey="name" stroke="#cbd5e1" tickLine={false} axisLine={false} />
                      <YAxis stroke="#cbd5e1" tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="frequency" fill="#818cf8" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-300" />
                  <h3 className="text-lg font-semibold text-white">Marks Distribution</h3>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={marksChartData}>
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                      <XAxis dataKey="name" stroke="#cbd5e1" tickLine={false} axisLine={false} />
                      <YAxis stroke="#cbd5e1" tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#34d399" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <h3 className="text-lg font-semibold text-white">Repeated Topics</h3>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
                <div className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr_0.7fr] gap-3 bg-slate-950 px-4 py-3 text-xs uppercase tracking-[0.15em] text-slate-400">
                  <span>Topic</span>
                  <span>Unit</span>
                  <span>Frequency</span>
                  <span>Papers</span>
                  <span>Priority</span>
                </div>
                {analysis.repeatedTopicsList.length ? (
                  analysis.repeatedTopicsList.map((entry) => (
                    <div key={`${entry.topic}-${entry.unit}`} className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr_0.7fr] gap-3 border-t border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-200">
                      <span className="font-medium text-white">{entry.topic}</span>
                      <span>{entry.unit}</span>
                      <span>{entry.frequency}</span>
                      <span>{Math.min(entry.frequency, analysis.papersAnalyzed)}</span>
                      <span className={entry.priority === 'Very High' ? 'text-rose-300' : entry.priority === 'High' ? 'text-amber-300' : 'text-emerald-300'}>{entry.priority}</span>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-sm text-slate-400">No repeated topics were detected in the uploaded question papers.</div>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-semibold text-white">High Priority Topics</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {analysis.highPriorityTopics.length ? (
                  analysis.highPriorityTopics.map((entry) => (
                    <span key={entry.topic} className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-sm text-indigo-100">
                      {entry.topic} · {entry.frequency}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">No strong topic patterns were found.</span>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <h3 className="text-lg font-semibold text-white">AI Predicted 2-Mark Questions</h3>
              </div>
              <div className="space-y-4">
                {analysis.predicted2MarkQuestions.map((item, index) => (
                  <article key={`${item.topic}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-lg font-medium text-white">{index + 1}. {item.question}</p>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                        Confidence {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-slate-300">
                      <p><span className="font-medium text-slate-100">Topic:</span> {item.topic}</p>
                      <p><span className="font-medium text-slate-100">Unit:</span> {item.unit}</p>
                      <p><span className="font-medium text-slate-100">Historical Frequency:</span> {item.frequency}</p>
                    </div>
                    <p className="mt-3 text-sm text-slate-400">Reason: {item.reason}</p>
                  </article>
                ))}
              </div>
              <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{analysis.disclaimer}</p>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-indigo-300" />
                <h3 className="text-lg font-semibold text-white">AI Predicted 11-Mark Questions</h3>
              </div>
              <div className="space-y-4">
                {analysis.predicted11MarkQuestions.map((item, index) => (
                  <article key={`${item.topic}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-lg font-medium text-white">{index + 1}. {item.question}</p>
                      <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-200">
                        Confidence {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-slate-300">
                      <p><span className="font-medium text-slate-100">Topic:</span> {item.topic}</p>
                      <p><span className="font-medium text-slate-100">Unit:</span> {item.unit}</p>
                      <p><span className="font-medium text-slate-100">Historical Frequency:</span> {item.frequency} occurrences</p>
                    </div>
                    <p className="mt-3 text-sm text-slate-400">Reason: {item.reason}</p>
                  </article>
                ))}
              </div>
              <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{analysis.disclaimer}</p>
            </Card>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={runAnalysis} variant="outline" className="gap-2" disabled={loading}>
                <RefreshCcw className="h-4 w-4" />
                Analyze Again
              </Button>
              <Button onClick={generateQuiz} variant="outline" className="gap-2" disabled={!analysis.highPriorityTopics.length}>
                <Sparkles className="h-4 w-4" />
                Generate Quiz
              </Button>
              <Button onClick={createStudyPlan} variant="outline" className="gap-2" disabled={!analysis.highPriorityTopics.length}>
                <BrainCircuit className="h-4 w-4" />
                Create Study Plan
              </Button>
              <Button onClick={exportReport} className="gap-2">
                <Download className="h-4 w-4" />
                Export Report
              </Button>
            </div>

            {quizNotice && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
                {quizNotice}
              </div>
            )}
            {planNotice && (
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-100">
                {planNotice}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}