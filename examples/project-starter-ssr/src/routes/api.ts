// Mock database storage
const mockDatabase = {
  tasks: [
    { id: 't1', title: 'Setup Jotai State Tree SSR', completed: true, category: 'Dev' },
    { id: 't2', title: 'Implement TanStack Start Actions', completed: true, category: 'Dev' },
    { id: 't3', title: 'Write unit tests for AsyncLocalStorage isolation', completed: false, category: 'QA' },
  ]
};

/**
 * Lightweight API routes mapping.
 */
export const apiRoutes = {
  // GET /api/status
  'status': async (req: any, res: any) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'ok',
      message: 'Jotai State Tree SSR engine running successfully',
      timestamp: Date.now(),
      concurrencyIsolation: 'AsyncLocalStorage active'
    }));
  },

  // GET /api/tasks
  'tasks': async (req: any, res: any) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(mockDatabase.tasks));
  }
};
