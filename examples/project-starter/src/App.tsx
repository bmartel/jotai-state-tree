import React, { useState, useEffect } from 'react';
import { observer, RouteView, createStoreContext, RouterProvider, useRouter } from 'jotai-state-tree/react';
import {
  onPatch,
  onSnapshot,
  applySnapshot,
} from 'jotai-state-tree';
import { JotaiStateTreeDevtools } from 'jotai-state-tree/devtools';
import { createAppStore, IRootStore } from './models/RootStore';
import { configureRouter } from './routes/router';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ToastProvider } from './components/Toast';

// Views
import { DashboardView } from './routes/DashboardView';
import { TasksView } from './routes/TasksView';
import { SettingsView } from './routes/SettingsView';
import { LoginView } from './routes/LoginView';

export const { Provider: StoreProvider, useStore } = createStoreContext<IRootStore>();

// Export useAppStore so other files don't break
export function useAppStore() {
  return useStore();
}

const pages = {
  dashboard: DashboardView,
  tasks: TasksView,
  settings: SettingsView,
  login: LoginView,
};

const AppContent = observer(function AppContent() {
  const store = useAppStore();
  const router = useRouter();
  const [devPanelOpen, setDevPanelOpen] = useState(true);
  const currentTheme = store.theme;

  // 2. Hydrate from localStorage and hook up updates
  useEffect(() => {
    if (store.persistenceEnabled) {
      const cached = localStorage.getItem('project-starter-state');
      if (cached) {
        try {
          applySnapshot(store, JSON.parse(cached));
        } catch (e) {
          console.error('Failed to load snapshot cache', e);
        }
      }
    }

    // Save snapshot on changes
    const disposeSnapshot = onSnapshot(store, (snapshot) => {
      if (store.persistenceEnabled) {
        localStorage.setItem(
          'project-starter-state',
          JSON.stringify(snapshot)
        );
      }
    });

    // Record patches in volatile dev panel feed
    const disposePatches = onPatch(store, (patch) => {
      store.logPatch(patch);
    });

    return () => {
      disposeSnapshot();
      disposePatches();
    };
  }, [store]);

  return (
    <ToastProvider>
      <div className={`flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-zinc-950 transition-colors duration-300 ${currentTheme}`}>
        {/* Left Sidebar navigation */}
        <Sidebar />

        {/* Core workspace layout */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header
            devPanelOpen={devPanelOpen}
            toggleDevPanel={() => setDevPanelOpen(!devPanelOpen)}
          />

          <main className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-zinc-950/20">
            <div className="max-w-5xl mx-auto">
              <RouteView
                pages={pages}
                fallback={
                  <div className="text-center py-20 space-y-4">
                    <h2 className="text-xl font-bold font-display text-slate-800 dark:text-zinc-200">
                      Route not matching page views
                    </h2>
                    <button
                      onClick={() => router.push('/')}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition-all"
                    >
                      Return to Dashboard
                    </button>
                  </div>
                }
              />
            </div>
          </main>
        </div>

        {/* Devtools Panel */}
        <JotaiStateTreeDevtools store={store} initialOpen={devPanelOpen} />
      </div>
    </ToastProvider>
  );
});

export const App = observer(function App() {
  return (
    <StoreProvider createStore={() => createAppStore()}>
      <AppWithRouter />
    </StoreProvider>
  );
});

const AppWithRouter = observer(function AppWithRouter() {
  const store = useAppStore();

  return (
    <RouterProvider createRouter={() => configureRouter(store)}>
      <AppContent />
    </RouterProvider>
  );
});
