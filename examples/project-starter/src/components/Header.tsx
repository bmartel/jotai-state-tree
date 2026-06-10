import { observer, useRouter } from 'jotai-state-tree/react';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  devPanelOpen: boolean;
  toggleDevPanel: () => void;
}

export const Header = observer(function Header({
  devPanelOpen,
  toggleDevPanel,
}: HeaderProps) {
  const router = useRouter();

  // Compute page name based on route
  const getPageTitle = () => {
    switch (router.pathname) {
      case '/':
        return 'Dashboard';
      case '/tasks':
        return 'Task Manager';
      case '/settings':
        return 'System Settings';
      case '/login':
        return 'Sign In';
      default:
        return 'Page Not Found';
    }
  };

  return (
    <header className="h-16 border-b border-slate-200/60 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-8 select-none z-10 sticky top-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
          App /
        </span>
        <span className="text-sm font-bold text-slate-800 dark:text-zinc-200 font-display">
          {getPageTitle()}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />

        {/* DevTools Drawer Toggle */}
        <button
          onClick={toggleDevPanel}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all duration-200 ${
            devPanelOpen
              ? 'bg-indigo-50 border-indigo-200/60 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-900/30 dark:text-indigo-400'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/80'
          }`}
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
              d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
            />
          </svg>
          {devPanelOpen ? 'Close DevTools' : 'Open DevTools'}
        </button>
      </div>
    </header>
  );
});
