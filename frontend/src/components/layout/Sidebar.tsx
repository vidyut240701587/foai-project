import { BarChart3, BookOpen, BrainCircuit, CalendarClock, CheckCircle2, Download, LayoutDashboard, NotebookPen, Search, Settings, UserCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/subjects', label: 'My Subjects', icon: BookOpen },
  { to: '/planner', label: 'Study Planner', icon: CalendarClock },
  { to: '/analysis', label: 'Analysis', icon: BarChart3 },
  { to: '/quiz', label: 'AI Quiz', icon: CheckCircle2 },
  { to: '/progress', label: 'Progress', icon: BrainCircuit },
  { to: '/notes', label: 'Notes', icon: NotebookPen },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/admin/import', label: 'Import', icon: Download },
];

export function Sidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-800 bg-slate-950/80 p-5 xl:block">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-lg font-bold text-indigo-300">S</div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-indigo-300">Smart Exam</div>
          <div className="text-sm font-semibold text-white">Planner</div>
        </div>
      </div>

      <Link to="/subjects" className="mb-6 block rounded-2xl border border-slate-800 bg-slate-900/60 p-3 hover:border-slate-600">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-indigo-200">
            <Search size={16} />
          </div>
          <div className="text-sm text-slate-300">Browse subjects</div>
        </div>
      </Link>

      <nav className="space-y-2">
        {items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-slate-300 transition hover:border-slate-700 hover:bg-slate-900/70 hover:text-white">
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-200">
            <UserCircle2 size={18} />
          </div>
          <div>
            <div className="font-medium text-white">{getUserName()}</div>
            <div className="text-xs text-slate-400">Your study workspace</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function getUserName() {
  try {
    return (JSON.parse(localStorage.getItem('smart_exam_user') || '{}') as { name?: string }).name || 'Student';
  } catch {
    return 'Student';
  }
}
