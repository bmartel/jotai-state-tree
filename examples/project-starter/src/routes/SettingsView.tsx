import React, { useState } from 'react';
import { observer } from 'jotai-state-tree/react';
import { useAppStore } from '../App';
import { useToast } from '../components/Toast';

export const SettingsView = observer(function SettingsView() {
  const store = useAppStore();
  const { showToast } = useToast();
  const [profileName, setProfileName] = useState(store.auth.currentUser || '');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    if (store.auth.isAuthenticated) {
      store.auth.login(profileName);
      showToast('Profile name updated!');
    } else {
      showToast('Please sign in first!', 'error');
    }
  };

  const handleTogglePersistence = () => {
    store.setPersistenceEnabled(!store.persistenceEnabled);
    if (store.persistenceEnabled) {
      showToast('State persistence activated!');
    } else {
      localStorage.removeItem('project-starter-state');
      showToast('State persistence deactivated. Storage cleared!', 'info');
    }
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to clear all tasks and logout?')) {
      store.resetStore();
      localStorage.removeItem('project-starter-state');
      setProfileName('');
      showToast('Application reset successfully!', 'info');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h2 className="font-display font-extrabold text-2xl text-slate-800 dark:text-zinc-100">
          System Settings
        </h2>
        <p className="text-xs text-slate-400 dark:text-zinc-500">
          Configure profile details, theme settings, and state snapshots
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 p-6 rounded-2xl shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
          Profile Settings
        </h3>
        
        {store.auth.isAuthenticated ? (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500 block">
                Profile Display Name
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Enter display name..."
                className="w-full max-w-md px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-zinc-850 dark:border-zinc-700/80 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={!profileName.trim() || profileName === store.auth.currentUser}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
            >
              Save Profile
            </button>
          </form>
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-900 rounded-xl text-center">
            <span className="block text-sm text-slate-500 dark:text-zinc-400 mb-3">
              You must be signed in to edit profile settings.
            </span>
          </div>
        )}
      </div>

      {/* Storage and Snapshots */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 p-6 rounded-2xl shadow-sm space-y-5">
        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
          State Caching & Storage
        </h3>

        {/* Persistence toggle option */}
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-900 rounded-xl">
          <div className="space-y-0.5">
            <span className="block text-sm font-semibold text-slate-800 dark:text-zinc-200">
              Save State Snapshots
            </span>
            <span className="block text-xs text-slate-400 dark:text-zinc-500">
              Sync state tree to localStorage automatically on changes.
            </span>
          </div>
          <button
            onClick={handleTogglePersistence}
            className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 ${
              store.persistenceEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-zinc-850'
            }`}
          >
            <div
              className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-200 ${
                store.persistenceEnabled ? 'translate-x-5.5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Theme configuration details */}
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-900 rounded-xl">
          <div className="space-y-0.5">
            <span className="block text-sm font-semibold text-slate-800 dark:text-zinc-200">
              Interface Color Theme
            </span>
            <span className="block text-xs text-slate-400 dark:text-zinc-500">
              Switch dark/light mode body configurations.
            </span>
          </div>
          <div className="flex bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800">
            {['light', 'dark'].map((theme) => (
              <button
                key={theme}
                onClick={() => store.setTheme(theme)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
                  store.theme === theme
                    ? 'bg-white text-slate-850 dark:bg-zinc-800 dark:text-zinc-100 shadow-sm'
                    : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-350'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dangerous Reset Zone */}
      <div className="bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/50 dark:border-rose-950/30 p-6 rounded-2xl shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-rose-700 dark:text-rose-450 uppercase tracking-wider">
            Reset Operations
          </h3>
          <p className="text-xs text-rose-600/80 dark:text-rose-500/75 mt-0.5">
            These operations are destructive. All local database changes will be purged.
          </p>
        </div>

        <button
          onClick={handleResetData}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm"
        >
          Clear Workspace Data
        </button>
      </div>
    </div>
  );
});
