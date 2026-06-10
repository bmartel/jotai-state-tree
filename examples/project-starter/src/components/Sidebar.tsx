import React from 'react';
import { observer, useRouter } from 'jotai-state-tree/react';
import { useAppStore } from '../App';

interface LinkProps {
  to: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const Link = observer(function Link({ to, children, icon }: LinkProps) {
  const router = useRouter();
  const isActive = router.pathname === to;

  return (
    <button
      onClick={() => router.push(to)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 font-semibold shadow-sm border border-indigo-100/50 dark:border-indigo-900/30'
          : 'text-slate-600 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200'
      }`}
    >
      {icon && (
        <span
          className={`w-5 h-5 flex items-center justify-center ${
            isActive ? 'text-indigo-500' : 'text-slate-400 dark:text-zinc-500'
          }`}
        >
          {icon}
        </span>
      )}
      {children}
    </button>
  );
});

export const Sidebar = observer(function Sidebar() {
  const store = useAppStore();
  const router = useRouter();

  return (
    <aside className="w-64 border-r border-slate-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-950 flex flex-col h-screen select-none">
      {/* Brand Logo */}
      <div className="h-16 flex items-center gap-3.5 px-6 border-b border-slate-100 dark:border-zinc-900">
        <span className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-sm shadow-indigo-500/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M10 2a.75.75 0 01.75.75v1.274a5.002 5.002 0 013.998 3.998h1.502a.75.75 0 010 1.5h-1.502a5.002 5.002 0 01-3.998 3.998v1.274a.75.75 0 01-1.5 0v-1.274a5.002 5.002 0 01-3.998-3.998H3.25a.75.75 0 010-1.5h1.502A5.002 5.002 0 018.75 4.024V2.75A.75.75 0 0110 2zm-3.25 7a3.25 3.25 0 116.5 0 3.25 3.25 0 01-6.5 0z"
              clipRule="evenodd"
            />
            <path d="M10 15a1 1 0 100 2 1 1 0 000-2z" />
          </svg>
        </span>
        <div>
          <span className="font-display font-bold text-slate-800 dark:text-zinc-100 text-base leading-none block">
            Jotai Starter
          </span>
          <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider dark:text-zinc-500">
            Workspace
          </span>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <Link
          to="/"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
          }
        >
          Dashboard
        </Link>

        <Link
          to="/tasks"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.107c0-1.242-1.008-2.25-2.25-2.25h-1.5a2.25 2.25 0 00-2.25 2.25v12.393A2.25 2.25 0 0018 18.75zm-12 0H6a2.25 2.25 0 01-2.25-2.25V6.107c0-1.242 1.008-2.25 2.25-2.25h1.5a2.25 2.25 0 012.25 2.25v12.393A2.25 2.25 0 016 18.75z"
              />
            </svg>
          }
        >
          Task Manager
        </Link>

        <Link
          to="/settings"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.645-.869l.214-1.28z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
        >
          Settings
        </Link>
      </nav>

      {/* User Footer Panel */}
      <div className="p-4 border-t border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/20">
        {store.auth.isAuthenticated ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white font-display font-semibold flex items-center justify-center text-base shadow-sm">
              {(store.auth.currentUser || 'A')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate">
                {store.auth.currentUser}
              </span>
              <span className="block text-xs text-slate-400 dark:text-zinc-500">
                Administrator
              </span>
            </div>
            <button
              onClick={() => {
                store.auth.logout();
                router.push('/login');
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              title="Logout"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => router.push('/login')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 transition-all duration-200 shadow-sm border border-transparent dark:border-zinc-700/50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            Sign In
          </button>
        )}
      </div>
    </aside>
  );
});
