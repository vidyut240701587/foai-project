import { FormEvent, useEffect, useState } from 'react';

import { Button } from '../components/ui/button';
import { apiFetch } from '../lib/api';

type ProfileResponse = { user: { name: string; email: string }; profile: { department: string | null; semester: string | null; preferredHours: number | null } | null };

export function SettingsPage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');
  const [dailyStudyHours, setDailyStudyHours] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch<ProfileResponse>('/auth/profile');
      setProfile(response);
      setDepartment(response.profile?.department ?? '');
      setSemester(response.profile?.semester ?? '');
      setDailyStudyHours(response.profile?.preferredHours ?? 3);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load account settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await apiFetch<ProfileResponse>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ department, semester, dailyStudyHours }),
      });
      setProfile(response);
      setMessage('Profile settings saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="min-h-screen bg-slate-950 p-6 text-slate-100"><div className="mx-auto max-w-3xl">
    <header className="mb-8"><p className="text-sm uppercase text-indigo-300">Account</p><h1 className="mt-2 text-3xl font-bold text-white">Settings</h1></header>
    {loading ? <p role="status">Loading your profile...</p> : <form onSubmit={saveProfile} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div><div className="text-sm text-slate-400">Name</div><div className="mt-1 text-white">{profile?.user.name}</div></div>
      <div><div className="text-sm text-slate-400">Email</div><div className="mt-1 text-white">{profile?.user.email}</div></div>
      <label className="block"><span className="mb-2 block text-sm text-slate-300">Department</span><input required value={department} onChange={(event) => setDepartment(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" /></label>
      <label className="block"><span className="mb-2 block text-sm text-slate-300">Semester</span><input required value={semester} onChange={(event) => setSemester(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" /></label>
      <label className="block"><span className="mb-2 block text-sm text-slate-300">Daily study hours</span><input required type="number" min={1} max={12} value={dailyStudyHours} onChange={(event) => setDailyStudyHours(Number(event.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" /></label>
      {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
      <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button>
    </form>}
    {error && <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100"><p>{error}</p><Button variant="outline" className="mt-3" onClick={loadProfile}>Retry</Button></div>}
  </div></div>;
}