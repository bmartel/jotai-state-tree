/**
 * @vitest-environment jsdom
 */
import React, { useState, useMemo, useEffect } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { types, onPatch, IJsonPatch, clearAllRegistries, resetGlobalStore } from '../index';
import { useSnapshot, useUndoManager, useTimeTravelManager } from '../react';

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
});

// Define Todo and TodoStore directly to ensure single module copy
const Todo = types
  .model('Todo', {
    id: types.identifier,
    title: types.string,
    done: types.optional(types.boolean, false),
  })
  .actions((self) => ({
    toggle() {
      self.done = !self.done;
    },
    setTitle(title: string) {
      self.title = title;
    },
  }));

const TodoStore = types
  .model('TodoStore', {
    todos: types.optional(types.array(Todo), []),
    filter: types.optional(types.string, 'all'),
  })
  .views((self) => ({
    get filteredTodos() {
      if (self.filter === 'completed') {
        return self.todos.filter((todo) => todo.done);
      }
      if (self.filter === 'active') {
        return self.todos.filter((todo) => !todo.done);
      }
      return self.todos;
    },
  }))
  .actions((self) => ({
    addTodo(title: string) {
      if (!title.trim()) return;
      self.todos.push({
        id: Math.random().toString(36).substring(2, 9),
        title,
        done: false,
      });
    },
    removeTodo(id: string) {
      const item = self.todos.find((t) => t.id === id);
      if (item) {
        self.todos.remove(item);
      }
    },
  }));

function App() {
  const store = useMemo(() => TodoStore.create({
    todos: [
      { id: '1', title: 'Learn jotai-state-tree', done: true },
      { id: '2', title: 'Explore Vite templates', done: false },
      { id: '3', title: 'Build clean minimalist UIs', done: false },
    ]
  }), []);

  useSnapshot(store);

  const undoManager = useUndoManager(store, { maxHistoryLength: 50 });
  const timeTravel = useTimeTravelManager(store, { maxSnapshots: 50, autoRecord: true });

  const [newTodoText, setNewTodoText] = useState('');
  const [patchLogs, setPatchLogs] = useState<Array<{ id: string; desc: string; patch: IJsonPatch }>>([]);

  useEffect(() => {
    const dispose = onPatch(store, (patch) => {
      setPatchLogs((logs) => [
        {
          id: Math.random().toString(),
          desc: `${patch.op.toUpperCase()} ${patch.path}`,
          patch,
        },
        ...logs.slice(0, 19),
      ]);
    });

    return () => {
      dispose();
    };
  }, [store, undoManager, timeTravel]);

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

      <div className="card">
        {store.filteredTodos.length === 0 ? (
          <p>No tasks to show</p>
        ) : (
          <ul className="todo-list">
            {store.filteredTodos.map((todo) => {
              console.log("RENDER TODO:", JSON.stringify(todo), "typeof toggle:", typeof (todo as any).toggle);
              return (
                <li key={todo.id} className="todo-item">
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => todo.toggle()}
                  />
                  <span>{todo.title}</span>
                  <button onClick={() => store.removeTodo(todo.id)}>Delete</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <button
          onClick={() => undoManager.undo()}
          disabled={!undoManager.canUndo}
        >
          Undo ({undoManager.undoLevels})
        </button>
        <button
          onClick={() => undoManager.redo()}
          disabled={!undoManager.canRedo}
        >
          Redo ({undoManager.redoLevels})
        </button>
      </div>

      <div className="card">
        <input
          type="range"
          min="0"
          max={Math.max(0, timeTravel.snapshotCount - 1)}
          value={timeTravel.currentIndex >= 0 ? timeTravel.currentIndex : 0}
          onChange={(e) => timeTravel.goTo(parseInt(e.target.value))}
          disabled={timeTravel.snapshotCount <= 1}
        />
        <span>Index: {timeTravel.currentIndex} / {timeTravel.snapshotCount - 1}</span>
      </div>
    </div>
  );
}

describe("Todo List Time Travel Example App", () => {
  it("should support adding, toggling, undoing, redoing, and time traveling", async () => {
    const user = userEvent.setup();
    
    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // 1. Verify initial list items
    expect(screen.getByText("Learn jotai-state-tree")).toBeDefined();
    expect(screen.getByText("Explore Vite templates")).toBeDefined();
    expect(screen.getByText("Build clean minimalist UIs")).toBeDefined();

    // 2. Try adding a new todo
    const input = screen.getByPlaceholderText("What needs to be done?");
    const addButton = screen.getByRole("button", { name: "Add" });

    await user.type(input, "Buy Milk");
    await user.click(addButton);

    // Verify it is added
    await waitFor(() => {
      expect(screen.getByText("Buy Milk")).toBeDefined();
    });

    // 3. Toggle the new todo
    const checkboxes = screen.getAllByRole("checkbox");
    const newTodoCheckbox = checkboxes[3]; // "Buy Milk" checkbox
    expect((newTodoCheckbox as HTMLInputElement).checked).toBe(false);

    await user.click(newTodoCheckbox);
    await waitFor(() => {
      expect((newTodoCheckbox as HTMLInputElement).checked).toBe(true);
    });

    // 4. Test Undo
    const undoButton = screen.getByRole("button", { name: /Undo/ });
    expect((undoButton as HTMLButtonElement).disabled).toBe(false);

    // Click Undo (should undo the toggle)
    await user.click(undoButton);
    await waitFor(() => {
      expect((newTodoCheckbox as HTMLInputElement).checked).toBe(false);
    });

    // Click Undo again (should undo the add)
    await user.click(undoButton);
    await waitFor(() => {
      expect(screen.queryByText("Buy Milk")).toBeNull();
    });

    // 5. Test Redo
    const redoButton = screen.getByRole("button", { name: /Redo/ });
    expect((redoButton as HTMLButtonElement).disabled).toBe(false);

    // Click Redo (should redo the add)
    await user.click(redoButton);
    await waitFor(() => {
      expect(screen.getByText("Buy Milk")).toBeDefined();
    });

    // 6. Test Time Travel (snapshots)
    const rangeInput = screen.getByRole("slider");
    expect((rangeInput as HTMLInputElement).value).toBe("2"); // Snapshots count: 3 (initial, add, toggle => index 2)
    
    // Drag slider back to 0 (initial state)
    await fireEventChange(rangeInput, 0);
    await waitFor(() => {
      expect(screen.queryByText("Buy Milk")).toBeNull();
    });

    // Drag slider forward to index 2
    await fireEventChange(rangeInput, 2);
    await waitFor(() => {
      expect(screen.getByText("Buy Milk")).toBeDefined();
    });
  });
});

async function fireEventChange(element: HTMLElement, value: number) {
  act(() => {
    const prototype = Object.getPrototypeOf(element);
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) {
      setter.call(element, String(value));
    } else {
      (element as HTMLInputElement).value = String(value);
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
