import { createRouter } from 'jotai-state-tree';
import { IRootStore } from '../models/RootStore';

export const routes = [
  { path: '/', name: 'dashboard' },
  { path: '/tasks', name: 'tasks', meta: { requiresAuth: true } },
  { path: '/settings', name: 'settings' },
  { path: '/login', name: 'login' },
];

export function configureRouter(store: IRootStore, initialUrl?: string) {
  const router = createRouter({
    routes,
    initialUrl,
    beforeNavigate: (from, to) => {
      // Find target route config
      const targetRoute = routes.find((r) => r.name === to.currentRouteName);
      if (targetRoute?.meta?.requiresAuth && !store.auth.isAuthenticated) {
        const redirectPath = to.pathname + to.search + to.hash;
        return `/login?redirect=${encodeURIComponent(redirectPath)}`;
      }
      return true;
    },
  });

  return router;
}
