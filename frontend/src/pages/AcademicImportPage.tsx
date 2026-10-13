import { ChangeEvent, useEffect, useState } from 'react';
import { Download } from 'lucide-react';

import { Button } from '../components/ui/button';
import { apiFetch, getApiUrl } from '../lib/api';

type RegulationOption = { code: string; sourceUrl: string };
type DepartmentOption = { code: string; name: string };
type SubjectOption = { code: string; name: string; semester: number };

const semesterLabels = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const officialAcademicsUrl = 'https://www.rajalakshmi.org/academics';

export function AcademicImportPage() {
  const [regulations, setRegulations] = useState<RegulationOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [semesters, setSemesters] = useState<number[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [regulation, setRegulation] = useState('R2023');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [loadingRegulations, setLoadingRegulations] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingSemesters, setLoadingSemesters] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [availabilityVerified, setAvailabilityVerified] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState('');

  const selectedDepartment = departments.find((option) => option.code === department);
  const selectedSubject = subjects.find((option) => option.code === subjectCode);

  useEffect(() => {
    let active = true;
    apiFetch<RegulationOption[]>('/academic/regulations')
      .then((data) => {
        if (!active) return;
        setRegulations(data);
        if (!data.some((option) => option.code === 'R2023')) setRegulation(data[0]?.code ?? '');
      })
      .catch(() => {
        if (!active) return;
        setUnavailable(true);
        setError('Official syllabus is currently unavailable for this selection.');
      })
      .finally(() => active && setLoadingRegulations(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!regulation) return;
    let active = true;
    setDepartments([]);
    setDepartment('');
    setSemesters([]);
    setSemester('');
    setSubjects([]);
    setSubjectCode('');
    setAvailabilityVerified(false);
    setUnavailable(false);
    setError('');
    setLoadingDepartments(true);

    apiFetch<DepartmentOption[]>(`/academic/departments?regulation=${encodeURIComponent(regulation)}`)
      .then((data) => {
        if (!active) return;
        setDepartments(data);
        setUnavailable(data.length === 0);
      })
      .catch(() => active && setUnavailable(true))
      .finally(() => active && setLoadingDepartments(false));

    return () => { active = false; };
  }, [regulation]);

  useEffect(() => {
    if (!regulation || !department) return;
    let active = true;
    setSemesters([]);
    setSemester('');
    setSubjects([]);
    setSubjectCode('');
    setAvailabilityVerified(false);
    setUnavailable(false);
    setLoadingSemesters(true);

    const query = new URLSearchParams({ regulation, department });
    apiFetch<number[]>(`/academic/semesters?${query}`)
      .then((data) => {
        if (!active) return;
        setSemesters(data);
        setUnavailable(data.length === 0);
      })
      .catch(() => active && setUnavailable(true))
      .finally(() => active && setLoadingSemesters(false));

    return () => { active = false; };
  }, [regulation, department]);

  useEffect(() => {
    if (!regulation || !department || !semester) return;
    let active = true;
    setSubjects([]);
    setSubjectCode('');
    setAvailabilityVerified(false);
    setUnavailable(false);
    setLoadingSubjects(true);

    const query = new URLSearchParams({ regulation, department, semester });
    apiFetch<SubjectOption[]>(`/academic/subjects?${query}`)
      .then((data) => {
        if (!active) return;
        setSubjects(data);
        setAvailabilityVerified(data.length > 0);
        setUnavailable(data.length === 0);
      })
      .catch(() => {
        if (!active) return;
        setAvailabilityVerified(false);
        setUnavailable(true);
      })
      .finally(() => active && setLoadingSubjects(false));

    return () => { active = false; };
  }, [regulation, department, semester]);

  const onRegulationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setDepartments([]);
    setDepartment('');
    setSemesters([]);
    setSemester('');
    setSubjects([]);
    setSubjectCode('');
    setAvailabilityVerified(false);
    setUnavailable(false);
    setRegulation(event.target.value);
  };

  const onDepartmentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSemesters([]);
    setSemester('');
    setSubjects([]);
    setSubjectCode('');
    setAvailabilityVerified(false);
    setUnavailable(false);
    setDepartment(event.target.value);
  };

  const onSemesterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSubjects([]);
    setSubjectCode('');
    setAvailabilityVerified(false);
    setUnavailable(false);
    setSemester(event.target.value);
  };

  const onSubjectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSubjectCode(event.target.value);
  };

  const downloadSyllabus = async () => {
    if (!selectedSubject) return;
    setDownloading(true);
    setError('');
    try {
      const query = new URLSearchParams({ regulation, department, subjectCode: selectedSubject.code });
      const response = await fetch(getApiUrl(`/academic/download?${query}`));
      if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) {
        throw new Error('Download failed');
      }

      const file = await response.blob();
      if (await file.slice(0, 4).text() !== '%PDF') throw new Error('Invalid PDF');

      const contentDisposition = response.headers.get('content-disposition') ?? '';
      const filename = /filename="([^"]+)"/i.exec(contentDisposition)?.[1]
        ?? `REC_${regulation}_${department}_Curriculum_and_Syllabus.pdf`;
      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setAvailabilityVerified(false);
      setUnavailable(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Import</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Download Official REC Syllabus</h1>
          <p className="mt-3 text-sm text-slate-400">
            Select your regulation, department, semester and subject to download the official syllabus.
          </p>
        </header>

        <section aria-label="Syllabus selection" className="grid gap-5 border-y border-slate-800 py-6 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-300">
            Regulation
            <select
              value={regulation}
              onChange={onRegulationChange}
              disabled={loadingRegulations || regulations.length === 0}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            >
              {regulations.map((option) => <option key={option.code} value={option.code}>{option.code}</option>)}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-300">
            Department
            <select
              value={department}
              onChange={onDepartmentChange}
              disabled={loadingDepartments || departments.length === 0}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            >
              <option value="">{loadingDepartments ? 'Loading departments...' : 'Select department'}</option>
              {departments.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-300">
            Semester
            <select
              value={semester}
              onChange={onSemesterChange}
              disabled={!department || loadingSemesters || semesters.length === 0}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            >
              <option value="">{loadingSemesters ? 'Loading semesters...' : 'Select semester'}</option>
              {semesters.map((option) => <option key={option} value={option}>Semester {option}</option>)}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-300">
            Subject
            <select
              value={subjectCode}
              onChange={onSubjectChange}
              disabled={!semester || loadingSubjects || subjects.length === 0}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            >
              <option value="">{loadingSubjects ? 'Loading subjects...' : 'Select subject'}</option>
              {subjects.map((option) => <option key={option.code} value={option.code}>{option.name} · {option.code}</option>)}
            </select>
          </label>
        </section>

        <p className="mt-3 text-xs text-slate-500">Only official REC curriculum documents are provided.</p>

        {unavailable && !loadingDepartments && !loadingSemesters && !loadingSubjects && (
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <p role="status" className="text-sm text-amber-200">
              Official syllabus is currently unavailable for this selection.
            </p>
            <Button type="button" variant="outline" disabled>
              Official syllabus unavailable
            </Button>
          </div>
        )}

        {selectedSubject && selectedDepartment && availabilityVerified && (
          <section aria-label="Selected subject syllabus" className="mt-7 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-300">{selectedSubject.code}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedSubject.name}</h2>
                <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-500">Course Code</dt><dd className="mt-1 text-slate-200">{selectedSubject.code}</dd></div>
                  <div><dt className="text-slate-500">Department</dt><dd className="mt-1 text-slate-200">{selectedDepartment.name} ({selectedDepartment.code})</dd></div>
                  <div><dt className="text-slate-500">Regulation</dt><dd className="mt-1 text-slate-200">{regulation}</dd></div>
                  <div><dt className="text-slate-500">Semester</dt><dd className="mt-1 text-slate-200">{semesterLabels[selectedSubject.semester] ?? selectedSubject.semester}</dd></div>
                </dl>
              </div>
              <Button type="button" onClick={downloadSyllabus} disabled={!availabilityVerified || downloading} className="shrink-0">
                <Download aria-hidden="true" size={16} className="mr-2" />
                {downloading ? 'Downloading...' : 'Download Official Syllabus'}
              </Button>
            </div>
            <p className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-400">
              Source: <a className="text-indigo-300 underline decoration-indigo-500/40 underline-offset-4 hover:text-indigo-200" href={officialAcademicsUrl} target="_blank" rel="noreferrer">Official Rajalakshmi Engineering College Curriculum &amp; Syllabus</a>
            </p>
          </section>
        )}

        {error && <p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}