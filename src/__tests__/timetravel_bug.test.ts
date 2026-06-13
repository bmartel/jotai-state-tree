import { describe, it, expect } from 'vitest';
import { types, applySnapshot, getSnapshot } from '../index';

const Task = types
  .model('Task', {
    id: types.identifier,
    text: types.string,
    completed: types.optional(types.boolean, false),
  })
  .actions((self) => ({
    toggle() {
      self.completed = !self.completed;
    },
  }));

const TaskStore = types
  .model('TaskStore', {
    items: types.optional(types.array(Task), []),
  })
  .actions((self) => ({
    addTask(id: string, text: string) {
      self.items.push({ id, text, completed: false });
    },
    deleteTask(id: string) {
      const idx = self.items.findIndex((item) => item.id === id);
      if (idx !== -1) {
        self.items.splice(idx, 1);
      }
    },
    replaceItems(newItems: any[]) {
      self.items.replace(newItems);
    },
  }));

describe("Timetravel bug reproduction", () => {
  it("reproduces deletion time travel", () => {
    const store = TaskStore.create({
      items: [
        { id: '1', text: 'Task 1' },
        { id: '2', text: 'Task 2' },
      ]
    });

    const snap0 = getSnapshot(store);

    // Add task 3
    store.addTask('3', 'Task 3');
    const snap1 = getSnapshot(store);

    // Delete task 2
    store.deleteTask('2');
    const snap2 = getSnapshot(store);

    expect(store.items.length).toBe(2);
    expect(store.items.map(t => t.id)).toEqual(['1', '3']);

    // Now try to time travel back to snap1 (which has task 2)
    console.log("Applying snap1...");
    applySnapshot(store, snap1);
    expect(store.items.length).toBe(3);
    expect(store.items.map(t => t.id)).toEqual(['1', '2', '3']);

    // Now try to time travel back to snap2
    console.log("Applying snap2...");
    applySnapshot(store, snap2);
    expect(store.items.length).toBe(2);
    expect(store.items.map(t => t.id)).toEqual(['1', '3']);
  });

  it("reproduces clearCompleted and replace time travel", () => {
    const store = TaskStore.create({
      items: [
        { id: '1', text: 'Task 1', completed: true },
        { id: '2', text: 'Task 2', completed: false },
      ]
    });

    const snapBefore = getSnapshot(store);

    // Call replace (clearCompleted equivalent)
    const activeItems = store.items.filter((item) => !item.completed);
    store.replaceItems(activeItems);

    expect(store.items.length).toBe(1);
    expect(store.items[0].id).toBe('2');

    // Time travel back
    console.log("Applying snapBefore...");
    applySnapshot(store, snapBefore);
    expect(store.items.length).toBe(2);
    expect(store.items.map(t => t.id)).toEqual(['1', '2']);
  });
});
