import { types, Instance } from 'jotai-state-tree';

export const Task = types
  .model('Task', {
    id: types.identifier,
    text: types.string,
    completed: types.optional(types.boolean, false),
    category: types.optional(types.string, 'Work'),
    createdAt: types.optional(types.string, () => new Date().toISOString()),
  })
  .actions((self) => ({
    toggle() {
      self.completed = !self.completed;
    },
    setText(newText: string) {
      if (newText.trim()) {
        self.text = newText.trim();
      }
    },
  }));

export const TaskStore = types
  .model('TaskStore', {
    items: types.optional(types.array(Task), []),
    filter: types.optional(types.string, 'All'),
    searchQuery: types.optional(types.string, ''),
    categoryFilter: types.optional(types.string, 'All'),
  })
  .views((self) => ({
    get completedCount() {
      return self.items.filter((item) => item.completed).length;
    },
    get activeCount() {
      return self.items.filter((item) => !item.completed).length;
    },
    get categories() {
      const cats = new Set(self.items.map((item) => item.category));
      return ['All', ...Array.from(cats)];
    },
    get filteredTasks() {
      return self.items.filter((item) => {
        const matchesFilter =
          self.filter === 'All' ||
          (self.filter === 'Active' && !item.completed) ||
          (self.filter === 'Completed' && item.completed);

        const matchesCategory =
          self.categoryFilter === 'All' || item.category === self.categoryFilter;

        const matchesSearch =
          !self.searchQuery ||
          item.text.toLowerCase().includes(self.searchQuery.toLowerCase());

        return matchesFilter && matchesCategory && matchesSearch;
      });
    },
  }))
  .actions((self) => ({
    addTask(text: string, category: string = 'Work') {
      if (text.trim()) {
        self.items.push({
          id: Math.random().toString(36).substring(2, 9),
          text: text.trim(),
          completed: false,
          category,
          createdAt: new Date().toISOString(),
        });
      }
    },
    deleteTask(id: string) {
      const itemIndex = self.items.findIndex((item) => item.id === id);
      if (itemIndex !== -1) {
        self.items.splice(itemIndex, 1);
      }
    },
    setFilter(filter: string) {
      self.filter = filter;
    },
    setSearchQuery(query: string) {
      self.searchQuery = query;
    },
    setCategoryFilter(category: string) {
      self.categoryFilter = category;
    },
    clearCompleted() {
      const activeItems = self.items.filter((item) => !item.completed);
      self.items.replace(activeItems);
    },
  }));

export type ITask = Instance<typeof Task>;
export type ITaskStore = Instance<typeof TaskStore>;
