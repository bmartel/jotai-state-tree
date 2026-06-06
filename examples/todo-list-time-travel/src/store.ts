import { types, Instance } from 'jotai-state-tree';

export const Todo = types
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

export const TodoStore = types
  .model('TodoStore', {
    todos: types.optional(types.array(Todo), []),
    filter: types.optional(types.string, 'all'), // 'all' | 'active' | 'completed'
  })
  .views((self) => ({
    get completedCount() {
      return self.todos.filter((todo) => todo.done).length;
    },
    get activeCount() {
      return self.todos.filter((todo) => !todo.done).length;
    },
    get totalCount() {
      return self.todos.length;
    },
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
    setFilter(filter: string) {
      self.filter = filter;
    },
    clearCompleted() {
      const completed = self.todos.filter((t) => t.done);
      completed.forEach((item) => self.todos.remove(item));
    },
    toggleAll(done: boolean) {
      self.todos.forEach((t) => {
        t.done = done;
      });
    },
  }));

export type ITodoStore = Instance<typeof TodoStore>;
export type ITodo = Instance<typeof Todo>;
