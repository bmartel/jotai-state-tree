import React, { useState, useEffect } from 'react';
import { createStoreContext } from 'jotai-state-tree/react';
import { onPatch, applySnapshot, getSnapshot, IJsonPatch } from 'jotai-state-tree';
import { KanbanBoard, IKanbanBoard } from './store';

const { Provider, useStore: useBoard, useStoreSnapshot: useBoardSnapshot } = createStoreContext<IKanbanBoard>();

function AppContent() {
  const board = useBoard();
  useBoardSnapshot();

  // States
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<'backlog' | 'todo' | 'in_progress' | 'done'>('todo');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  
  const [newMemberName, setNewMemberName] = useState('');
  const [snapshotText, setSnapshotText] = useState('');
  const [patchLogs, setPatchLogs] = useState<Array<{ id: string; desc: string; patch: IJsonPatch }>>([]);

  // Subscribe to patches
  useEffect(() => {
    const dispose = onPatch(board, (patch) => {
      setPatchLogs((logs) => [
        {
          id: Math.random().toString(),
          desc: `${patch.op.toUpperCase()} ${patch.path}`,
          patch,
        },
        ...logs.slice(0, 19),
      ]);
    });
    return dispose;
  }, [board]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const id = 't_' + Math.random().toString(36).substring(2, 9);
    board.addTask(id, newTaskTitle, newTaskStatus, newTaskAssignee || undefined);
    setNewTaskTitle('');
    setNewTaskAssignee('');
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    const id = 'u_' + Math.random().toString(36).substring(2, 9);
    board.addUser(id, newMemberName);
    setNewMemberName('');
  };

  const handleExportSnapshot = () => {
    const rawSnap = getSnapshot(board);
    setSnapshotText(JSON.stringify(rawSnap, null, 2));
  };

  const handleApplySnapshot = () => {
    try {
      const parsed = JSON.parse(snapshotText);
      applySnapshot(board, parsed);
    } catch (err: any) {
      alert(`Invalid snapshot JSON: ${err?.message || err}`);
    }
  };

  const columns: Array<{ key: 'backlog' | 'todo' | 'in_progress' | 'done'; title: string; tasks: any[] }> = [
    { key: 'backlog', title: 'Backlog', tasks: board.backlogTasks },
    { key: 'todo', title: 'To Do', tasks: board.todoTasks },
    { key: 'in_progress', title: 'In Progress', tasks: board.inProgressTasks },
    { key: 'done', title: 'Done', tasks: board.doneTasks },
  ];

  return (
    <div className="container-wide">
      <header>
        <div>
          <h1>Kanban Board</h1>
          <p className="subtitle">Reference management, dynamic maps, and patch tracking</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleExportSnapshot}>Export Snapshot</button>
        </div>
      </header>

      {/* Grid columns */}
      <div className="kanban-grid">
        {columns.map((col) => (
          <div key={col.key} className="kanban-column">
            <div className="column-header">
              <h3 className="column-title">{col.title}</h3>
              <span className="column-count">{col.tasks.length}</span>
            </div>
            
            <div className="card-list">
              {col.tasks.map((task) => {
                // Resolved assignee node from safe reference
                const assignee = task.assignee;
                return (
                  <div key={task.id} className="kanban-card">
                    <p className="card-title">{task.title}</p>
                    <div className="card-footer">
                      <span className="card-assignee">
                        {assignee ? assignee.name : 'Unassigned'}
                      </span>
                      <div className="card-actions">
                        <select
                          value={task.status}
                          onChange={(e) => task.setStatus(e.target.value as any)}
                        >
                          <option value="backlog">Backlog</option>
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                        <button
                          className="icon-btn"
                          onClick={() => board.removeTask(task.id)}
                          title="Delete Card"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Task Creation & Member Management */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div className="panel">
          <div className="panel-title">Add New Task Card</div>
          <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text"
              placeholder="Task description..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                style={{ flexGrow: 1 }}
                value={newTaskStatus}
                onChange={(e: any) => setNewTaskStatus(e.target.value)}
              >
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <select
                style={{ flexGrow: 1 }}
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
              >
                <option value="">Assign To...</option>
                {board.usersList.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="primary">Create Task</button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-title">Team Management</div>
          <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="New member name..."
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
            />
            <button type="submit" className="primary" style={{ whiteSpace: 'nowrap' }}>Add Member</button>
          </form>

          <div style={{ marginTop: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-gray-500)', display: 'block', marginBottom: '6px' }}>
              Active Members (Click 'x' to delete and test safe-reference cleanup):
            </span>
            {board.usersList.map((user) => (
              <span key={user.id} className="member-tag">
                {user.name}
                <button
                  className="icon-btn"
                  style={{ padding: 0 }}
                  onClick={() => board.removeUser(user.id)}
                  title="Remove Member"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </span>
            ))}
          </div>
          
          <div style={{ marginTop: '12px', fontSize: '11px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--color-primary)' }}>
            <strong>💡 Safe Reference Demonstration:</strong> If you delete a member, any task cards assigned to them will automatically update to "Unassigned" without breaking the state tree!
          </div>
        </div>
      </div>

      {/* Snapshot and Patch consoles */}
      <div className="workspace-footer">
        <div className="panel">
          <div className="panel-title">JSON Patches Output Console</div>
          <div className="logs-box">
            {patchLogs.length === 0 ? (
              <span style={{ color: 'var(--color-gray-400)' }}>Perform actions to generate real-time JSON patches...</span>
            ) : (
              patchLogs.map((log) => (
                <div key={log.id} style={{ marginBottom: '6px', borderBottom: '1px solid var(--color-gray-100)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{log.desc}</span>
                  <pre style={{ margin: '2px 0 0 0', whiteSpace: 'pre-wrap', color: 'var(--color-gray-500)', fontSize: '10px' }}>
                    {JSON.stringify(log.patch, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Snapshot Editor</div>
          <textarea
            className="snapshot-area"
            value={snapshotText}
            onChange={(e) => setSnapshotText(e.target.value)}
            placeholder="Click 'Export Snapshot' to fill, or paste a snapshot JSON and click apply..."
          />
          <button
            onClick={handleApplySnapshot}
            disabled={!snapshotText.trim()}
            style={{ width: '100%' }}
            className="primary"
          >
            Apply Snapshot
          </button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Provider createStore={() => {
      const store = KanbanBoard.create({
        users: {
          'u1': { id: 'u1', name: 'Alice Smith' },
          'u2': { id: 'u2', name: 'Bob Jones' },
          'u3': { id: 'u3', name: 'Charlie Brown' },
        },
        tasks: {}
      });
      // Add default tasks
      store.addTask('t1', 'Define project requirements', 'backlog');
      store.addTask('t2', 'Design database schema', 'todo', 'u1');
      store.addTask('t3', 'Implement jotai-state-tree integration', 'in_progress', 'u2');
      store.addTask('t4', 'Set up build pipeline', 'done', 'u3');
      return store;
    }}>
      <AppContent />
    </Provider>
  );
}
