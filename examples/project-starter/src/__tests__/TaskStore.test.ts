import { expect, test, describe } from 'vitest';
import { TaskStore } from '../models/TaskStore';

describe('TaskStore Model (SPA)', () => {
  test('initializes with default values', () => {
    const store = TaskStore.create();
    expect(store.items.length).toBe(0);
    expect(store.filter).toBe('All');
    expect(store.searchQuery).toBe('');
    expect(store.categoryFilter).toBe('All');
  });

  test('adds a task successfully', () => {
    const store = TaskStore.create();
    store.addTask('Test task 1', 'Engineering');

    expect(store.items.length).toBe(1);
    expect(store.items[0].text).toBe('Test task 1');
    expect(store.items[0].completed).toBe(false);
    expect(store.items[0].category).toBe('Engineering');
  });

  test('toggles and deletes tasks', () => {
    const store = TaskStore.create();
    store.addTask('Test task 1');
    const task = store.items[0];
    
    // Toggle completed state
    task.toggle();
    expect(task.completed).toBe(true);
    expect(store.completedCount).toBe(1);
    expect(store.activeCount).toBe(0);

    // Delete task
    store.deleteTask(task.id);
    expect(store.items.length).toBe(0);
  });

  test('filters tasks by completion state and category', () => {
    const store = TaskStore.create({
      items: [
        { id: '1', text: 'Task 1', completed: false, category: 'Engineering' },
        { id: '2', text: 'Task 2', completed: true, category: 'Design' },
        { id: '3', text: 'Task 3', completed: false, category: 'Design' },
      ],
    });

    // Verify initial values
    expect(store.filteredTasks.length).toBe(3);

    // Filter by completed
    store.setFilter('Completed');
    expect(store.filteredTasks.length).toBe(1);
    expect(store.filteredTasks[0].id).toBe('2');

    // Filter by Active
    store.setFilter('Active');
    expect(store.filteredTasks.length).toBe(2);

    // Filter by category
    store.setCategoryFilter('Design');
    expect(store.filteredTasks.length).toBe(1);
    expect(store.filteredTasks[0].id).toBe('3');

    // Filter by search query
    store.setFilter('All');
    store.setCategoryFilter('All');
    store.setSearchQuery('Task 2');
    expect(store.filteredTasks.length).toBe(1);
    expect(store.filteredTasks[0].id).toBe('2');
  });

  test('clears completed tasks', () => {
    const store = TaskStore.create({
      items: [
        { id: '1', text: 'Task 1', completed: true },
        { id: '2', text: 'Task 2', completed: false },
      ]
    });

    store.clearCompleted();
    expect(store.items.length).toBe(1);
    expect(store.items[0].id).toBe('2');
  });
});
