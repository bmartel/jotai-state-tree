import { describe, it, expect } from 'vitest';
import { types, getSnapshot, createUndoManager, createTimeTravelManager } from '../index';

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
    clearCompleted() {
      const completed = self.todos.filter((t) => t.done);
      completed.forEach((item) => self.todos.remove(item));
    },
  }));

describe("Todo app history integration", () => {
  it("should match todo example time travel flow with action grouping", () => {
    const store = TodoStore.create({
      todos: [
        { id: '1', title: 'Learn jotai-state-tree', done: true },
        { id: '2', title: 'Explore Vite templates', done: false },
        { id: '3', title: 'Build clean minimalist UIs', done: false },
      ]
    });

    const undoManager = createUndoManager(store, { maxHistoryLength: 50 });
    const timeTravel = createTimeTravelManager(store, { maxSnapshots: 50, autoRecord: true });

    expect(timeTravel.snapshotCount).toBe(1);
    expect(timeTravel.currentIndex).toBe(0);

    // 1. Add todo
    store.addTodo("New Task");
    expect(store.todos.length).toBe(4);
    expect(timeTravel.snapshotCount).toBe(2);
    expect(timeTravel.currentIndex).toBe(1);

    // 2. Toggle todo done
    const newTodo = store.todos[3];
    newTodo.toggle();
    expect(newTodo.done).toBe(true);
    expect(timeTravel.snapshotCount).toBe(3);
    expect(timeTravel.currentIndex).toBe(2);

    // 3. Clear completed (which should remove Learn jotai-state-tree and New Task in a single action)
    store.clearCompleted();
    expect(store.todos.length).toBe(2);
    // Should group the multiple removals in clearCompleted into a single snapshot update
    expect(timeTravel.snapshotCount).toBe(4);
    expect(timeTravel.currentIndex).toBe(3);

    // 4. Undo clearCompleted
    undoManager.undo();
    expect(store.todos.length).toBe(4);
    // Time travel should not have recorded new snapshots during undo
    expect(timeTravel.snapshotCount).toBe(4);
    expect(timeTravel.currentIndex).toBe(3);

    // 5. Time travel back 2 steps
    timeTravel.goBack(); // Back to state after toggle
    expect(store.todos.length).toBe(4);
    expect(store.todos[3].done).toBe(true);

    timeTravel.goBack(); // Back to state after addTodo
    expect(store.todos.length).toBe(4);
    expect(store.todos[3].done).toBe(false);

    undoManager.dispose();
    timeTravel.dispose();
  });
});
