import { expect, test, describe } from 'vitest';
import { TaskStore } from '../models/TaskStore';

describe('TaskStore Model (SSR Isolation)', () => {
  test('initializes with default values and is isolated', () => {
    const store = TaskStore.create();
    expect(store.items.length).toBe(0);
    expect(store.filter).toBe('All');
  });

  test('adds a task successfully', () => {
    const store = TaskStore.create();
    store.addTask('SSR Isolated Task', 'Engineering');

    expect(store.items.length).toBe(1);
    expect(store.items[0].text).toBe('SSR Isolated Task');
    expect(store.items[0].completed).toBe(false);
  });

  test('toggles and deletes tasks', () => {
    const store = TaskStore.create();
    store.addTask('Task A');
    const task = store.items[0];
    
    task.toggle();
    expect(task.completed).toBe(true);

    store.deleteTask(task.id);
    expect(store.items.length).toBe(0);
  });
});
