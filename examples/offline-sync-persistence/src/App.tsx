import React, { useState, useEffect, useMemo } from 'react';
import { types, getSnapshot, getGlobalStore } from 'jotai-state-tree';
import { usePersistentModel, observer } from 'jotai-state-tree/react';

// ============================================================================
// State Tree Model Definitions
// ============================================================================

const Todo = types
  .model('Todo', {
    id: types.identifier,
    title: types.string,
    completed: types.boolean,
  })
  .actions((self) => ({
    setTitle(newTitle: string) {
      self.title = newTitle;
    },
    toggle() {
      self.completed = !self.completed;
    },
  }));

const TodoStore = types
  .model('TodoStore', {
    todos: types.array(Todo),
  })
  .actions((self) => ({
    addTodo(title: string) {
      const id = Math.random().toString(36).substring(2, 9);
      self.todos.push({ id, title, completed: false });
    },
    removeTodo(id: string) {
      const idx = self.todos.findIndex((t) => t.id === id);
      if (idx !== -1) {
        self.todos.splice(idx, 1);
      }
    },
  }));

// ============================================================================
// API Mock & Server Simulation
// ============================================================================

interface ServerLog {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

// In-memory mock server database
let serverDatabase = {
  todos: [
    { id: 'initial-1', title: 'Explore jotai-state-tree persistence', completed: true },
    { id: 'initial-2', title: 'Simulate network latency or offline mode', completed: false },
    { id: 'initial-3', title: 'Trigger a server validation error to test rollback', completed: false },
  ],
};

// ============================================================================
// Main App Component
// ============================================================================

export const App = observer(() => {
  // Simulator Controls (react state to drive mock network behaviour)
  const [isApiOnline, setIsApiOnline] = useState<boolean>(true);
  const [serverLatency, setServerLatency] = useState<number>(
    typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ? 0 : 300
  );
  const [shouldRejectSync, setShouldRejectSync] = useState<boolean>(false);
  const [logs, setLogs] = useState<ServerLog[]>([
    {
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      message: 'Server mock initialized. Base database seeded.',
    },
  ]);

  // Track pending sync count and queue from IndexedDB manually for visualization
  const [indexedDbQueue, setIndexedDbQueue] = useState<any[]>([]);

  const addLog = (type: ServerLog['type'], message: string) => {
    setLogs((prev) => [
      { timestamp: new Date().toLocaleTimeString(), type, message },
      ...prev.slice(0, 19), // Limit to last 20 logs
    ]);
  };

  // Define Mock Network API query and mutations bound to simulator controls
  const queryOptions = useMemo(() => ({
    queryKey: 'todos',
    queryFn: async () => {
      // Simulate Latency
      await new Promise((resolve) => setTimeout(resolve, serverLatency));

      if (!isApiOnline) {
        addLog('error', 'GET /api/todos failed: Network Offline');
        throw new Error('Network offline');
      }

      addLog('success', 'GET /api/todos returned fresh snapshot');
      return JSON.parse(JSON.stringify(serverDatabase));
    },
    staleTime: 5000,
    refetchOnReconnect: true,
  }), [isApiOnline, serverLatency]);

  const mutationOptions = useMemo(() => ({
    syncFn: async (snapshot: any, patches: any[]) => {
      await new Promise((resolve) => setTimeout(resolve, serverLatency));

      if (!isApiOnline) {
        addLog('warning', `Mutation queued: Server Offline (${patches.length} updates)`);
        throw new Error('Network Offline');
      }

      if (shouldRejectSync) {
        addLog('error', 'PUT /api/todos rejected: Validation failed (Simulated Error)');
        throw new Error('400 Bad Request: Inappropriate words detected.');
      }

      // Check if any added/replaced todo contains "forbidden"
      const hasForbiddenWord = snapshot.todos.some((t: any) => 
        t.title.toLowerCase().includes('forbidden') || t.title.toLowerCase().includes('invalid')
      );
      if (hasForbiddenWord) {
        addLog('error', 'PUT /api/todos rejected: Validation failed (Forbidden text)');
        throw new Error('422 Unprocessable Entity: Title violates safety rules.');
      }

      // Apply changes to mock database
      serverDatabase = JSON.parse(JSON.stringify(snapshot));
      const patchDetails = patches.map(p => `${p.op.toUpperCase()} ${p.path}`).join(', ');
      addLog('success', `PUT /api/todos succeeded: Synchronized ${patches.length} patches (${patchDetails}).`);
      return serverDatabase;
    },
    shouldRollback: (error: any) => {
      // Rollback for validation/API errors, don't rollback for connection/network failures
      const errMsg = error.message.toLowerCase();
      return errMsg.includes('bad request') || errMsg.includes('unprocessable') || errMsg.includes('validation');
    },
    onSuccess: () => {
      refreshDbQueue();
    },
    onError: (err: any) => {
      refreshDbQueue();
      alert(`Sync Error: ${err.message}\nOptimistic changes will be rolled back.`);
    }
  }), [isApiOnline, serverLatency, shouldRejectSync]);

  // Hook to instantiate the persistent state tree model, connected to IndexedDB!
  const { model: store, persistence, status } = usePersistentModel(
    TodoStore,
    { todos: [] },
    {
      dbName: 'task-hub-persistence',
      key: 'todos-store-key',
      maxQueueSize: 5, // Compact automatically when queue exceeds 5 items
      query: queryOptions,
      mutation: mutationOptions,
    }
  );

  // Helper to fetch the actual IndexedDB queue to display it on screen
  const refreshDbQueue = async () => {
    try {
      const q = await (persistence as any).storage.getQueue('todos-store-key');
      setIndexedDbQueue(q);
    } catch {
      // Ignored if storage fails
    }
  };

  // Re-sync network state with persistence manager
  useEffect(() => {
    const pStatus = getGlobalStore().get(persistence.statusAtom);
    if (pStatus.isOffline !== !isApiOnline) {
      getGlobalStore().set(persistence.statusAtom, (prev: any) => ({
        ...prev,
        isOffline: !isApiOnline,
      }));
      if (isApiOnline) {
        addLog('info', 'Network restored. Reconnecting sync engine.');
        persistence.sync();
      } else {
        addLog('warning', 'Network disconnected. Local modifications will queue.');
      }
    }
  }, [isApiOnline, persistence]);

  // Refresh IndexedDB queue visualization on mounts and status updates
  useEffect(() => {
    refreshDbQueue();
  }, [status.pendingSyncCount]);

  // Forms Actions
  const [newTitle, setNewTitle] = useState('');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    store.addTodo(newTitle.trim());
    setNewTitle('');
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header glass-panel" style={{ padding: '20px 30px' }}>
        <div className="logo-section">
          <h1>Resilient Task Hub</h1>
          <p>jotai-state-tree IndexedDB Persistence, Background Sync & Optimistic UI</p>
        </div>

        {/* Network & Latency Console */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>NETWORK SIMULATOR</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className={isApiOnline ? 'primary' : 'secondary'} 
                onClick={() => setIsApiOnline(true)}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                🟢 ONLINE
              </button>
              <button 
                className={!isApiOnline ? 'danger' : 'secondary'} 
                onClick={() => setIsApiOnline(false)}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                🔴 OFFLINE
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SERVER ERROR MODE</span>
            <button 
              className={shouldRejectSync ? 'danger' : 'secondary'}
              onClick={() => setShouldRejectSync(!shouldRejectSync)}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              ⚠️ {shouldRejectSync ? 'REJECT ALL (Validation Error)' : 'NORMAL'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>LATENCY: {serverLatency}ms</span>
            <input 
              type="range" 
              min="0" 
              max="2000" 
              step="100" 
              value={serverLatency} 
              onChange={(e) => setServerLatency(Number(e.target.value))}
              style={{ width: '120px' }}
            />
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '30px', alignItems: 'start' }}>
        
        {/* Left Column: Tasks Board */}
        <section className="glass-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Tasks List</h2>
            {status.isFetching && <span style={{ fontSize: '12px', color: 'var(--accent)' }} className="pulse">🔄 Refreshing from API...</span>}
          </div>

          {/* Form */}
          <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Add a new task (type 'forbidden' to test rollback)..." 
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit">Add Task</button>
          </form>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {store.todos.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                No tasks available. Add one above to begin.
              </div>
            ) : (
              store.todos.map((todo) => (
                <div key={todo.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 20px' }}>
                  <input 
                    type="checkbox" 
                    checked={todo.completed} 
                    onChange={() => todo.toggle()}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <input 
                    type="text" 
                    value={todo.title}
                    onChange={(e) => todo.setTitle(e.target.value)}
                    style={{ flex: 1, background: 'none', border: 'none', padding: 0, fontSize: '15px', textDecoration: todo.completed ? 'line-through' : 'none', color: todo.completed ? 'var(--text-secondary)' : 'var(--text-primary)' }}
                  />
                  <button className="secondary danger" onClick={() => store.removeTodo(todo.id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right Column: Telemetry Dashboard */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Status Indicators */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Sync Engine Status</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>LOCAL CACHE</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--primary)' }}>
                  Active (IndexedDB)
                </span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>SYNC STATUS</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: status.isOffline ? 'var(--danger)' : status.isSyncing ? 'var(--accent)' : 'var(--primary)' }} className={status.isSyncing ? 'pulse' : ''}>
                  {status.isOffline ? 'Offline' : status.isSyncing ? 'Syncing...' : 'Synchronized'}
                </span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>PENDING MUTATIONS</span>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>
                  {status.pendingSyncCount} operations
                </span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>ERROR STATE</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: status.error ? 'var(--danger)' : 'var(--text-secondary)' }}>
                  {status.error ? 'Failure' : 'None'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="secondary" onClick={() => persistence.fetch(true)} style={{ flex: 1, padding: '8px', fontSize: '12px' }}>
                Force Pull API
              </button>
              <button className="secondary" onClick={() => persistence.compact()} style={{ flex: 1, padding: '8px', fontSize: '12px' }}>
                Compact Queue
              </button>
              <button className="secondary danger" onClick={() => { if(confirm('Reset local database?')) { persistence.clear(); window.location.reload(); } }} style={{ flex: 1, padding: '8px', fontSize: '12px' }}>
                Clear DB
              </button>
            </div>
          </div>

          {/* Offline Sync Queue Log */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>IndexedDB Sync Queue</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Auto-compact threshold: 5</span>
            </div>

            <div style={{ background: '#05070c', borderRadius: '8px', padding: '12px', minHeight: '100px', maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
              {indexedDbQueue.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', padding: '30px' }}>
                  Queue empty. Changes are pushed to API immediately when online.
                </div>
              ) : (
                indexedDbQueue.map((item, idx) => (
                  <div key={item.id ?? idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '6px 0', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent)' }}>
                      <span>Mutation #{item.id}</span>
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {item.patches.map((p: any, pIdx: number) => (
                      <div key={pIdx} style={{ color: 'var(--text-primary)', marginLeft: '10px' }}>
                        • {p.op.toUpperCase()} {p.path} {p.value ? `→ ${JSON.stringify(p.value)}` : ''}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* API Server Logs */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Mock Server Logs (HTTP Traffic)</h3>
            
            <div style={{ background: '#05070c', borderRadius: '8px', padding: '12px', minHeight: '150px', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {logs.map((log, index) => (
                <div key={index} style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>[{log.timestamp}]</span>
                  <span style={{ 
                    color: log.type === 'success' ? 'var(--primary)' : 
                           log.type === 'warning' ? '#f59e0b' : 
                           log.type === 'error' ? 'var(--danger)' : 'var(--accent)',
                    fontWeight: 'bold',
                    marginRight: '8px'
                  }}>
                    {log.type.toUpperCase()}:
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>{log.message}</span>
                </div>
              ))}
            </div>
          </div>

        </section>
      </main>
    </div>
  );
});
