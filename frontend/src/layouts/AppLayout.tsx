import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { Link } from 'react-router-dom';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <nav aria-label="Main navigation" className="flex gap-2 overflow-x-auto border-b border-slate-800 px-4 py-3 xl:hidden">
            {[
              ['/dashboard', 'Home'],
              ['/subjects', 'Subjects'],
              ['/planner', 'Planner'],
              ['/analysis', 'Analysis'],
              ['/quiz', 'Quiz'],
              ['/progress', 'Progress'],
              ['/ai', 'AI'],
              ['/settings', 'Settings'],
              ['/admin/import', 'Import'],
            ].map(([to, label]) => <Link key={to} to={to} className="shrink-0 rounded-full border border-slate-800 px-3 py-2 text-xs text-slate-300 hover:border-indigo-500 hover:text-white">{label}</Link>)}
          </nav>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
