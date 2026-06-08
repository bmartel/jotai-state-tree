import { types, Instance, createRouter } from 'jotai-state-tree';

// ============================================================================
// Auth Store Model
// ============================================================================
export const AuthStore = types
  .model('AuthStore', {
    isAuthenticated: types.optional(types.boolean, false),
    currentUser: types.maybeNull(types.string),
  })
  .actions((self) => ({
    login(username: string) {
      if (username.trim()) {
        self.isAuthenticated = true;
        self.currentUser = username.trim();
      }
    },
    logout() {
      self.isAuthenticated = false;
      self.currentUser = null;
    },
  }));

// ============================================================================
// Book Model
// ============================================================================
export const Book = types.model('Book', {
  id: types.identifier,
  title: types.string,
  author: types.string,
  price: types.number,
  category: types.string,
  synopsis: types.string,
});

// ============================================================================
// Navigation Log Model
// ============================================================================
export const NavigationLog = types.model('NavigationLog', {
  id: types.identifier,
  timestamp: types.string,
  message: types.string,
});

// ============================================================================
// Root Store Model
// ============================================================================
export const RootStore = types
  .model('RootStore', {
    auth: AuthStore,
    books: types.array(Book),
    navigationLogs: types.optional(types.array(NavigationLog), []),
  })
  .actions((self) => ({
    addLog(message: string) {
      self.navigationLogs.push({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        message,
      });
    },
    clearLogs() {
      self.navigationLogs.clear();
    },
  }));

// Mock book catalog data
const mockBooks = [
  {
    id: '1',
    title: 'Designing Data-Intensive Applications',
    author: 'Martin Kleppmann',
    price: 39.99,
    category: 'Tech',
    synopsis: 'An in-depth guide to the principles and practicalities of modern data system architectures. It covers data models, storage engines, distributed systems, and stream processing.',
  },
  {
    id: '2',
    title: 'The Pragmatic Programmer',
    author: 'Andy Hunt & Dave Thomas',
    price: 34.99,
    category: 'Tech',
    synopsis: 'Classic advice on software craftsmanship, career development, and coding best practices. A must-read for any developer wanting to improve their craft.',
  },
  {
    id: '3',
    title: 'Dune',
    author: 'Frank Herbert',
    price: 14.99,
    category: 'Sci-Fi',
    synopsis: 'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, who would become the mysterious man known as Muad\'Dib, leading a rebellion to reclaim control of the galaxy\'s most precious substance: spice.',
  },
  {
    id: '4',
    title: 'Neuromancer',
    author: 'William Gibson',
    price: 12.99,
    category: 'Sci-Fi',
    synopsis: 'Case was the sharpest data-thief in the business, until he crossed the wrong people. Now, hired for a mysterious run, he plunges into the cyber-underworld and face-to-face with a powerful artificial intelligence.',
  },
  {
    id: '5',
    title: 'The Hobbit',
    author: 'J.R.R. Tolkien',
    price: 10.99,
    category: 'Fantasy',
    synopsis: 'The classic fantasy adventure of Bilbo Baggins as he is whisked away on a quest by Gandalf the Wizard and a band of dwarves to reclaim the Lonely Mountain and its treasure from the dragon Smaug.',
  },
  {
    id: '6',
    title: 'Good Omens',
    author: 'Neil Gaiman & Terry Pratchett',
    price: 9.99,
    category: 'Fantasy',
    synopsis: 'According to The Nice and Accurate Prophecies of Agnes Nutter, Witch, the world will end on a Saturday. Next Saturday, in fact. So the armies of Good and Evil are amassing, but a fast-living demon and a fussy angel aren\'t looking forward to the rapture.',
  },
];

// ============================================================================
// Router Configuration
// ============================================================================
export const routes = [
  { path: '/', name: 'home' },
  { path: '/books', name: 'books' },
  { path: '/books/:id', name: 'book-details' },
  { path: '/admin', name: 'admin', meta: { requiresAuth: true } },
  { path: '/login', name: 'login' },
  { path: '/files/*', name: 'files' },
];

export function createAppStore() {
  const store = RootStore.create({
    auth: {
      isAuthenticated: false,
      currentUser: null,
    },
    books: mockBooks,
    navigationLogs: [],
  });

  const router = createRouter({
    routes,
    beforeNavigate: (from, to) => {
      // If route requires auth and user is not authenticated, redirect to login
      const targetRoute = routes.find(r => r.name === to.currentRouteName);
      if (targetRoute?.meta?.requiresAuth && !store.auth.isAuthenticated) {
        const redirectPath = to.pathname + to.search + to.hash;
        store.addLog(`GUARD BLOCKED: ${to.pathname} (Redirecting to /login)`);
        return `/login?redirect=${encodeURIComponent(redirectPath)}`;
      }
      return true;
    },
    afterNavigate: (to) => {
      store.addLog(`NAVIGATED: ${router.action} to ${to.pathname}${to.search}${to.hash}`);
    },
  });

  // Initial log to note start location
  store.addLog(`INITIALIZED: At ${router.pathname}${router.search}${router.hash}`);

  return { store, router };
}

// Type definitions
export type IRootStore = Instance<typeof RootStore>;
export type IBook = Instance<typeof Book>;
