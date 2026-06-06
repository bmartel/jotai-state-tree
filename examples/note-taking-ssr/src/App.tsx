import { useState, useMemo } from 'react';
import { createStore } from 'jotai';
import { setGlobalStore } from 'jotai-state-tree';
import { createStoreContext, useHydrateStore } from 'jotai-state-tree/react';
import { NotesStore, INotesStore } from './store';

// 1. Create a typed React Context for our store instance
const { Provider, useStore, useStoreSnapshot } = createStoreContext<INotesStore>();

// 2. Define a mock snapshot representing pre-rendered data from a server (SSR)
const MOCK_SERVER_SNAPSHOT = {
  notes: {
    'ssr1': {
      id: 'ssr1',
      title: '🚀 SSR Hydration in jotai-state-tree',
      content: 'This note represents pre-rendered server state. The client-side application hydrated this state instantly on startup without UI flickering.',
      category: 'Guides',
      updatedAt: Date.now()
    },
    'ssr2': {
      id: 'ssr2',
      title: '💡 Custom Jotai Store Binding',
      content: 'Under the hood, jotai-state-tree binds to Jotai stores. In multi-tenant environments or micro-frontends, you can isolate states by providing a custom, scoped store instance.',
      category: 'Architecture',
      updatedAt: Date.now() - 60000
    }
  },
  selectedNoteId: 'ssr1'
};

export function App() {
  // 3. Create a unique Jotai store scope for this component tree.
  // Prevents global state leaks (essential for server-side rendering environments)
  useMemo(() => {
    const js = createStore();
    setGlobalStore(js as any); // Bind jotai-state-tree to this isolated Jotai instance
  }, []);

  // 4. Instantiate our jotai-state-tree model.
  // We initialize it empty, because we will hydrate it from our SSR snapshot.
  const storeInstance = useMemo(() => NotesStore.create({}), []);

  return (
    <Provider store={storeInstance}>
      <div className="container-notes">
        <header>
          <div>
            <h1>SSR Notes Manager</h1>
            <p className="subtitle">Context Providers, isolated Jotai stores, and client hydration</p>
          </div>
          <span className="state-badge active">Hydration: Active</span>
        </header>

        {/* Note App Workspace */}
        <NoteWorkspace />

        {/* SSR / Hydration Devtools Panel */}
        <SSRGuidancePanel />
      </div>
    </Provider>
  );
}

// Separate component to demonstrate useStore and useStoreSnapshot hooks
function NoteWorkspace() {
  const store = useStore();
  
  // Hydrate the store with the pre-rendered server snapshot before the first paint
  useHydrateStore(store, MOCK_SERVER_SNAPSHOT);

  const [searchQuery, setSearchQuery] = useState('');
  
  // Subscribe to derived store variables
  const selectedNote = useStoreSnapshot((s) => s.selectedNote);
  const notesList = useStoreSnapshot((s) => s.searchNotes(searchQuery));

  return (
    <div className="notes-layout">
      {/* Sidebar List */}
      <div className="sidebar">
        <button
          className="primary"
          onClick={() => store.addNote('Untitled Note', '')}
        >
          + Add New Note
        </button>

        <input
          type="text"
          className="search-input"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="notes-list">
          {notesList.map((note) => {
            const isActive = selectedNote?.id === note.id;
            return (
              <button
                key={note.id}
                className={`note-item ${isActive ? 'active' : ''}`}
                onClick={() => store.selectNote(note.id)}
              >
                <h4 className="note-item-title">{note.title || 'Untitled Note'}</h4>
                <p className="note-item-preview">{note.content || 'No description...'}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Note Editor Details */}
      <div className="editor-panel">
        {selectedNote ? (
          <>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                className="note-title-input"
                value={selectedNote.title}
                onChange={(e) => selectedNote.updateTitle(e.target.value)}
                placeholder="Title..."
              />
              <select
                value={selectedNote.category}
                onChange={(e) => selectedNote.setCategory(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="General">General</option>
                <option value="Guides">Guides</option>
                <option value="Architecture">Architecture</option>
                <option value="Personal">Personal</option>
              </select>
              <button
                className="danger"
                style={{ padding: '6px 10px', fontSize: '12px' }}
                onClick={() => store.removeNote(selectedNote.id)}
              >
                Delete
              </button>
            </div>
            <textarea
              className="note-textarea"
              value={selectedNote.content}
              onChange={(e) => selectedNote.updateContent(e.target.value)}
              placeholder="Start writing..."
            />
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, color: 'var(--color-gray-400)', fontSize: '14px' }}>
            No note selected. Select a note or create one to edit.
          </div>
        )}
      </div>
    </div>
  );
}

function SSRGuidancePanel() {
  const rawSnap = useStoreSnapshot((s) => s);

  return (
    <div className="ssr-tools">
      <div className="panel">
        <div className="panel-title">Hydration Logs</div>
        <div className="console-box">
          <div style={{ color: '#10b981' }}>[00:00:00] Initialized isolated Jotai global store scope.</div>
          <div style={{ color: '#10b981' }}>[00:00:01] useHydrateStore called with 2 mock server records.</div>
          <div style={{ color: '#10b981' }}>[00:00:01] Client tree synchronized successfully with zero DOM mismatch.</div>
          <div style={{ color: 'var(--color-gray-500)', marginTop: '8px' }}>
            * Note mutations update atoms in the isolated store, safeguarding multithreaded SSR processes.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Current Client Snapshot</div>
        <pre className="console-box" style={{ maxHeight: '140px' }}>
          {JSON.stringify(rawSnap, null, 2)}
        </pre>
      </div>
    </div>
  );
}
