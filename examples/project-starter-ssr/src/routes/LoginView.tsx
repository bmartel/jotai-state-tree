import React, { useState } from 'react';
import { observer, useRouter } from 'jotai-state-tree/react';
import { useAppStore } from '../App';
import { useToast } from '../components/Toast';

export const LoginView = observer(function LoginView() {
  const store = useAppStore();
  const router = useRouter();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');

  const redirectTarget = router.query.redirect || '/';
  const wasRedirected = !!router.query.redirect;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    store.auth.login(username);
    showToast(`Welcome back, ${username}!`);
    
    // Redirect back to target URL or dashboard
    router.replace(decodeURIComponent(redirectTarget));
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4 select-none animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 p-8 rounded-2xl shadow-lg space-y-6">
        <div className="space-y-1.5 text-center">
          <span className="p-3 rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-950/20 dark:text-indigo-400 inline-block">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </span>
          <h2 className="font-display font-extrabold text-xl text-slate-800 dark:text-zinc-100">
            Sign In Required
          </h2>
          <p className="text-xs text-slate-400 dark:text-zinc-500">
            Enter your name to access secure areas of this workspace.
          </p>
        </div>

        {wasRedirected && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100/50 dark:border-amber-900/30 text-xs">
            <span className="mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <p className="leading-relaxed">
              You were redirected because the page <strong>{decodeURIComponent(redirectTarget)}</strong> requires active user authentication.
            </p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="username" className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500 block">
              Display Name / Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. guest"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700/80 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={!username.trim()}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
          >
            Authenticate & Continue
          </button>
        </form>
      </div>
    </div>
  );
});
