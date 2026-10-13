import { FormEvent, useState } from 'react';
import { LogOut, Search, UserCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { apiFetch, clearSession } from '../../lib/api';

export function Topbar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [name] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem('smart_exam_user') || '{}') as { name?: string }).name || 'Profile';
    } catch {
      return 'Profile';
    }
  });

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(`/subjects${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''}`);
  };

  const logout = () => {
    void apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined).finally(() => {
      clearSession();
      navigate('/login', { replace: true });
    });
  };

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur-xl">
      <form onSubmit={search} className="flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-300">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search subjects" className="w-48 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500" placeholder="Search subjects" />
      </form>

      <div className="flex items-center gap-3">
        <Link to="/settings" className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 hover:border-slate-500">
          <UserCircle2 size={16} />
          {name}
        </Link>
        <button type="button" title="Log out" aria-label="Log out" onClick={logout} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/60 text-slate-200 hover:border-red-500/60 hover:text-red-200">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
