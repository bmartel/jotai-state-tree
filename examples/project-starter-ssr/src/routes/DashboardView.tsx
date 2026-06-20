import React, { useState } from 'react';
import { observer, useRouter } from 'jotai-state-tree/react';
import { useAppStore } from '../App';
import { useToast } from '../components/Toast';

export const DashboardView = observer(function DashboardView() {
  const store = useAppStore();
  const router = useRouter();
  const { showToast } = useToast();
  const [newTaskText, setNewTaskText] = useState('');

  const total = store.tasks.items.length;
  const completed = store.tasks.completedCount;
  const active = store.tasks.activeCount;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    store.tasks.addTask(newTaskText, 'Quick Tasks');
    setNewTaskText('');
    showToast('Task added successfully!');
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Hero banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-10 shadow-lg text-white shadow-indigo-500/10">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-44 h-44 rounded-full bg-white/10 blur-2xl"></div>
        <div className="relative max-w-lg space-y-3">
          <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-md">
            Productivity Workspace
          </span>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl leading-tight">
            Welcome, {store.auth.isAuthenticated ? store.auth.currentUser : 'Guest User'}!
          </h2>
          <p className="text-white/80 text-sm md:text-base leading-relaxed">
            Manage your goals, track live patches, and scrub application history using our state management inspector tools.
          </p>
        </div>
      </div>

      {/* Grid statistics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Completed */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 p-6 rounded-2xl shadow-sm glow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider block">Completed</span>
            <span className="font-display font-extrabold text-3xl text-slate-800 dark:text-zinc-100 block">{completed}</span>
            <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-0.5">
              <span>+ {completed} since starting</span>
            </span>
          </div>
          <span className="p-3.5 rounded-xl bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20 dark:text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        </div>

        {/* Card 2: Active */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 p-6 rounded-2xl shadow-sm glow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider block">Active Tasks</span>
            <span className="font-display font-extrabold text-3xl text-slate-800 dark:text-zinc-100 block">{active}</span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">Require execution</span>
          </div>
          <span className="p-3.5 rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-950/20 dark:text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        </div>

        {/* Card 3: Completion Rate */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 p-6 rounded-2xl shadow-sm glow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider block">Completion Rate</span>
            <span className="font-display font-extrabold text-3xl text-slate-800 dark:text-zinc-100 block">{completionRate}%</span>
            <span className="text-[10px] text-indigo-500 font-semibold">Overall productivity</span>
          </div>
          <div className="relative w-12 h-12 flex items-center justify-center">
            {/* SVG Progress Circle */}
            <svg className="w-12 h-12 transform -rotate-90">
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3.5" className="text-slate-100 dark:text-zinc-800" fill="transparent" />
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3.5" className="text-indigo-500 transition-all duration-500" fill="transparent"
                strokeDasharray={125.6} strokeDashoffset={125.6 - (125.6 * completionRate) / 100} />
            </svg>
            <span className="absolute text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{completionRate}%</span>
          </div>
        </div>

        {/* Card 4: Session Security */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 p-6 rounded-2xl shadow-sm glow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider block">User Security</span>
            <span className="font-display font-semibold text-lg text-slate-800 dark:text-zinc-200 block truncate max-w-[120px]">
              {store.auth.isAuthenticated ? 'Protected' : 'Unsigned'}
            </span>
            <button onClick={() => router.push(store.auth.isAuthenticated ? '/settings' : '/login')} className="text-[10px] text-indigo-500 font-semibold hover:underline">
              {store.auth.isAuthenticated ? 'Manage Profile' : 'Authenticate'} &rarr;
            </button>
          </div>
          <span className={`p-3.5 rounded-xl ${store.auth.isAuthenticated ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-950/20 dark:text-indigo-400' : 'bg-rose-50 text-rose-500 dark:bg-rose-950/20 dark:text-rose-400'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </span>
        </div>
      </div>

      {/* Main grids: charts and quick tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG Area Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-slate-800 dark:text-zinc-100 text-lg">Activity Simulation</h3>
              <p className="text-xs text-slate-400 dark:text-zinc-500">Live request rates matched with patch updates</p>
            </div>
            <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400">
              Live Chart
            </span>
          </div>

          <div className="w-full h-48">
            <svg viewBox="0 0 500 150" className="w-full h-full text-indigo-500/20">
              <defs>
                <linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(99, 102, 241)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="rgb(99, 102, 241)" stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(200,200,200,0.15)" strokeDasharray="3" />
              <line x1="0" y1="75" x2="500" y2="75" stroke="rgba(200,200,200,0.15)" strokeDasharray="3" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="rgba(200,200,200,0.15)" strokeDasharray="3" />
              
              {/* Area */}
              <path d="M 0,150 L 0,110 Q 50,70 100,90 T 200,40 T 300,80 T 400,30 T 500,60 L 500,150 Z" fill="url(#colorGrad)" />
              {/* Line */}
              <path d="M 0,110 Q 50,70 100,90 T 200,40 T 300,80 T 400,30 T 500,60" fill="none" stroke="rgb(99, 102, 241)" strokeWidth="3" />
              
              {/* Interaction nodes */}
              <circle cx="100" cy="90" r="4" fill="white" stroke="rgb(99, 102, 241)" strokeWidth="2" />
              <circle cx="200" cy="40" r="4" fill="white" stroke="rgb(99, 102, 241)" strokeWidth="2" />
              <circle cx="300" cy="80" r="4" fill="white" stroke="rgb(99, 102, 241)" strokeWidth="2" />
              <circle cx="400" cy="30" r="4" fill="white" stroke="rgb(99, 102, 241)" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Quick Task add form */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h3 className="font-display font-bold text-slate-800 dark:text-zinc-100 text-lg">Quick Tasks</h3>
              <p className="text-xs text-slate-400 dark:text-zinc-500">Insert new milestones immediately in task tree</p>
            </div>

            <form onSubmit={handleQuickAdd} className="space-y-3">
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="Enter milestone title..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700/80 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
              />
              <button
                type="submit"
                disabled={!newTaskText.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
              >
                Insert Milestone
              </button>
            </form>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-zinc-800 mt-6 flex justify-between items-center text-xs text-slate-400 dark:text-zinc-500">
            <span>Current task load: {total} total</span>
            <button onClick={() => router.push('/tasks')} className="text-indigo-500 font-semibold hover:underline">
              Go to Manager &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
