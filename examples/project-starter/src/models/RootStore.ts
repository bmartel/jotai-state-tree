import { types, Instance } from 'jotai-state-tree';
import { AuthStore } from './AuthStore';
import { TaskStore } from './TaskStore';

export const RootStore = types
  .model('RootStore', {
    auth: AuthStore,
    tasks: TaskStore,
    theme: types.optional(types.string, 'light'),
    persistenceEnabled: types.optional(types.boolean, true),
  })
  .volatile(() => ({
    patchLogs: [] as any[],
  }))
  .actions((self) => ({
    toggleTheme() {
      self.theme = self.theme === 'light' ? 'dark' : 'light';
    },
    setTheme(theme: string) {
      self.theme = theme;
    },
    setPersistenceEnabled(enabled: boolean) {
      self.persistenceEnabled = enabled;
    },
    logPatch(patch: any) {
      // Add patch to the front of the list, limit to 50 logs
      self.patchLogs.unshift({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        patch,
      });
      if (self.patchLogs.length > 50) {
        self.patchLogs.pop();
      }
    },
    clearPatchLogs() {
      self.patchLogs = [];
    },
    resetStore() {
      self.tasks.items.clear();
      self.tasks.filter = 'All';
      self.tasks.searchQuery = '';
      self.tasks.categoryFilter = 'All';
      self.auth.logout();
    },
  }));

export type IRootStore = Instance<typeof RootStore>;

// Helper to create initial store and setup mock tasks
export function createAppStore(initialAuth = {}) {
  const store = RootStore.create({
    auth: {
      isAuthenticated: false,
      currentUser: null,
      ...initialAuth,
    },
    tasks: {
      items: [
        { id: 't1', text: 'Scaffold the new template', completed: true, category: 'Engineering' },
        { id: 't2', text: 'Configure Tailwind CSS v3', completed: true, category: 'Design' },
        { id: 't3', text: 'Implement routing guards', completed: false, category: 'Engineering' },
        { id: 't4', text: 'Add interactive developer panel', completed: false, category: 'Product' },
        { id: 't5', text: 'Write comprehensive documentation', completed: false, category: 'Docs' },
      ],
      filter: 'All',
      searchQuery: '',
      categoryFilter: 'All',
    },
    theme: 'light',
    persistenceEnabled: true,
  });

  return store;
}
