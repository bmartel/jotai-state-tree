import React, { useState, useEffect } from 'react';
import { createStoreContext, useUndoManager, useTimeTravelManager } from 'jotai-state-tree/react';
import { onPatch, IJsonPatch } from 'jotai-state-tree';
import { TodoStore, ITodoStore } from './store';

const { Provider, useStore, useStoreSnapshot } = createStoreContext<ITodoStore>();

function AppContent() {
  const store = useStore();
  useStoreSnapshot();

  // Initialize managers cleanly using dedicated hooks
  const undoManager = useUndoManager(store, { maxHistoryLength: 50 });
  const timeTravel = useTimeTravelManager(store, { maxSnapshots: 50, autoRecord: true });

  // States
  const [newTodoText, setNewTodoText] = useState('');
  const [patchLogs, setPatchLogs] = useState<Array<{ id: string; desc: string; patch: IJsonPatch }>>([]);

  // Track patches for the live developer logs panel
  useEffect(() => {
    const dispose = onPatch(store, (patch) => {
      setPatchLogs((logs) => [
        {
          id: Math.random().toString(),
          desc: `${patch.op.toUpperCase()} ${patch.path}`,
          patch,
        },
        ...logs.slice(0, 19), // Keep last 20 patches
      ]);
    });

    return () => {
      dispose();
    };
  }, [store]);

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    store.addTodo(newTodoText);
    setNewTodoText('');
  };

  return (
    <div className="container">
      <header>
        <h1>Todo List</h1>
        <p className="subtitle">State Tree with Undo/Redo & Time Travel</p>
      </header>

      {/* Todo Input Card */}
      <div className="card">
        <form onSubmit={handleAddTodo} className="flex-row">
          <input
            type="text"
            placeholder="What needs to be done?"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
          />
          <button type="submit" className="primary">Add</button>
        </form>
      </div>

      {/* Main List Card */}
      <div className="card">
        <div className="flex-between" style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <div className="filters">
            <button
              className={`filter-btn ${store.filter === 'all' ? 'active' : ''}`}
              onClick={() => store.setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${store.filter === 'active' ? 'active' : ''}`}
              onClick={() => store.setFilter('active')}
            >
              Active ({store.activeCount})
            </button>
            <button
              className={`filter-btn ${store.filter === 'completed' ? 'active' : ''}`}
              onClick={() => store.setFilter('completed')}
            >
              Completed ({store.completedCount})
            </button>
          </div>
          
          <div className="flex-row">
            <button 
              onClick={() => store.toggleAll(store.completedCount !== store.totalCount)}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              {store.completedCount === store.totalCount ? 'Unmark All' : 'Mark All'}
            </button>
            {store.completedCount > 0 && (
              <button 
                onClick={() => store.clearCompleted()}
                style={{ fontSize: '12px', padding: '4px 8px' }}
              >
                Clear Completed
              </button>
            )}
          </div>
        </div>

        {store.filteredTodos.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-gray-400)', fontSize: '14px', margin: '20px 0' }}>
            No tasks to show
          </p>
        ) : (
          <ul className="todo-list">
            {store.filteredTodos.map((todo) => (
              <li key={todo.id} className="todo-item">
                <div className="flex-row" style={{ flexGrow: 1 }}>
                  <input
                    type="checkbox"
                    className="todo-checkbox"
                    checked={todo.done}
                    onChange={() => todo.toggle()}
                  />
                  <span
                    className={`todo-text ${todo.done ? 'completed' : ''}`}
                    onClick={() => todo.toggle()}
                  >
                    {todo.title}
                  </span>
                </div>
                <button
                  className="icon-btn"
                  onClick={() => store.removeTodo(todo.id)}
                  title="Delete Task"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Undo/Redo & Time Travel Card */}
      <div className="card">
        <div className="flex-between">
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-gray-800)' }}>History Management</span>
          <div className="flex-row">
            <button
              onClick={() => undoManager.undo()}
              disabled={!undoManager.canUndo}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Undo ({undoManager.undoLevels})
            </button>
            <button
              onClick={() => undoManager.redo()}
              disabled={!undoManager.canRedo}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Redo ({undoManager.redoLevels})
            </button>
          </div>
        </div>

        <div className="history-controls">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-gray-500)' }}>
            <span>Time Travel (Snapshots)</span>
            <span>Index: {timeTravel.currentIndex} / {timeTravel.snapshotCount - 1}</span>
          </div>
          
          <div className="history-slider-wrapper">
            <button
              onClick={() => timeTravel.goBack()}
              disabled={!timeTravel.canGoBack}
              style={{ padding: '4px 8px' }}
            >
              &larr;
            </button>
            <input
              type="range"
              min="0"
              max={Math.max(0, timeTravel.snapshotCount - 1)}
              value={timeTravel.currentIndex >= 0 ? timeTravel.currentIndex : 0}
              onChange={(e) => timeTravel.goTo(parseInt(e.target.value))}
              disabled={timeTravel.snapshotCount <= 1}
            />
            <button
              onClick={() => timeTravel.goForward()}
              disabled={!timeTravel.canGoForward}
              style={{ padding: '4px 8px' }}
            >
              &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Patches Console Card */}
      <div className="card">
        <div className="logs-title">Applied Patches Stream</div>
        <div className="logs-list">
          {patchLogs.length === 0 ? (
            <div style={{ color: 'var(--color-gray-400)' }}>No actions performed yet. Interact with the UI to see patches.</div>
          ) : (
            patchLogs.map((log) => (
              <div key={log.id} style={{ marginBottom: '6px', borderBottom: '1px solid var(--color-gray-100)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{log.desc}</span>
                <pre style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap', color: 'var(--color-gray-500)' }}>
                  {JSON.stringify(log.patch.value !== undefined ? { op: log.patch.op, path: log.patch.path, value: log.patch.value } : { op: log.patch.op, path: log.patch.path }, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Provider createStore={() => TodoStore.create({
      todos: [
        { id: '1', title: 'Learn jotai-state-tree', done: true },
        { id: '2', title: 'Explore Vite templates', done: false },
        { id: '3', title: 'Build clean minimalist UIs', done: false },
      ]
    })}>
      <AppContent />
    </Provider>
  );
}
