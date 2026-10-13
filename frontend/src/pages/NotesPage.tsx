import { useEffect, useState } from 'react';

import { Button } from '../components/ui/button';
import { apiFetch } from '../lib/api';

type Note = {
  id: string;
  subjectId: string;
  title: string;
  unitName: string | null;
  content: string;
  sourceUrl: string | null;
  subject: { name: string; code: string };
};
type Subject = { id: string; name: string; code: string };

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [unitName, setUnitName] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadNotes = async () => {
    setLoading(true);
    setError('');
    try {
      const [noteResults, subjectResults] = await Promise.all([
        apiFetch<Note[]>('/notes'),
        apiFetch<{ subjects: Subject[] }>('/subjects'),
      ]);
      setNotes(noteResults);
      setSubjects(subjectResults.subjects);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your notes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNotes(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setUnitName('');
    setContent('');
    setSubjectId('');
  };

  const saveNote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (editingId) {
        await apiFetch(`/notes/${editingId}`, { method: 'PATCH', body: JSON.stringify({ title, unitName, content }) });
        setMessage('Note updated.');
      } else {
        await apiFetch('/notes', { method: 'POST', body: JSON.stringify({ subjectId, title, unitName, content }) });
        setMessage('Note saved.');
      }
      resetForm();
      await loadNotes();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this note.');
    } finally {
      setSaving(false);
    }
  };

  const editNote = (note: Note) => {
    setEditingId(note.id);
    setSubjectId(note.subjectId);
    setTitle(note.title);
    setUnitName(note.unitName ?? '');
    setContent(note.content);
  };

  const deleteNote = async (note: Note) => {
    setError('');
    setMessage('');
    try {
      await apiFetch(`/notes/${note.id}`, { method: 'DELETE' });
      setNotes((current) => current.filter((item) => item.id !== note.id));
      if (editingId === note.id) resetForm();
      setMessage('Note deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this note.');
    }
  };

  const visibleNotes = notes.filter((note) => `${note.title} ${note.unitName ?? ''} ${note.subject.name} ${note.content}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="min-h-screen bg-slate-950 p-6 text-slate-100"><div className="mx-auto max-w-6xl">
    <header className="mb-8"><p className="text-sm uppercase text-indigo-300">Study materials</p><h1 className="mt-2 text-3xl font-bold text-white">Notes</h1></header>
    <form onSubmit={saveNote} className="mb-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:grid-cols-2">
      {!editingId && <label className="text-sm text-slate-300">Subject<select required value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"><option value="">Choose a subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} · {subject.name}</option>)}</select></label>}
      <label className="text-sm text-slate-300">Title<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" /></label>
      <label className="text-sm text-slate-300">Unit<input value={unitName} onChange={(event) => setUnitName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" /></label>
      <label className="text-sm text-slate-300 sm:col-span-2">Note content<textarea required rows={4} value={content} onChange={(event) => setContent(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" /></label>
      <div className="flex gap-3 sm:col-span-2"><Button type="submit" disabled={saving || (!editingId && !subjects.length)}>{saving ? 'Saving...' : editingId ? 'Update note' : 'Save note'}</Button>{editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}</div>
    </form>
    <label className="mb-5 block text-sm text-slate-300">Search notes<input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" placeholder="Search title, subject, or content" /></label>
    {message && <p role="status" className="mb-4 text-sm text-emerald-300">{message}</p>}
    {loading && <p role="status" className="text-slate-300">Loading saved notes...</p>}
    {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100"><p>{error}</p><Button variant="outline" className="mt-3" onClick={loadNotes}>Retry</Button></div>}
    {!loading && !error && (visibleNotes.length ? <div className="space-y-4">{visibleNotes.map((note) => <article key={note.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-indigo-300">{note.subject.code} · {note.subject.name}</p><h2 className="mt-1 text-xl font-semibold text-white">{note.title}</h2><p className="text-sm text-slate-400">{note.unitName ?? 'Unit not specified'}</p></div><div className="flex gap-3">{note.sourceUrl && <a href={note.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-indigo-300">Open source</a>}<Button type="button" size="sm" variant="outline" onClick={() => editNote(note)}>Edit</Button><Button type="button" size="sm" variant="outline" onClick={() => deleteNote(note)}>Delete</Button></div></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">{note.content}</p></article>)}</div> : <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">No matching notes. Create one above or adjust your search.</div>)}
  </div></div>;
}