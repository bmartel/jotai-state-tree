import { types, Instance } from 'jotai-state-tree';

export const User = types.model('User', {
  id: types.identifier,
  name: types.string,
});

export const Task = types
  .model('Task', {
    id: types.identifier,
    title: types.string,
    status: types.union(
      types.literal('backlog'),
      types.literal('todo'),
      types.literal('in_progress'),
      types.literal('done')
    ),
    // safeReference returns undefined if the target model is deleted/removed from the tree
    assignee: types.safeReference(User),
  })
  .actions((self) => ({
    setStatus(status: 'backlog' | 'todo' | 'in_progress' | 'done') {
      self.status = status;
    },
    setAssignee(user: IUser | undefined) {
      self.assignee = user;
    },
    setTitle(title: string) {
      self.title = title;
    },
  }));

export const KanbanBoard = types
  .model('KanbanBoard', {
    users: types.optional(types.map(User), {}),
    tasks: types.optional(types.map(Task), {}),
  })
  .views((self) => ({
    get backlogTasks() {
      return Array.from(self.tasks.values()).filter((t) => t.status === 'backlog');
    },
    get todoTasks() {
      return Array.from(self.tasks.values()).filter((t) => t.status === 'todo');
    },
    get inProgressTasks() {
      return Array.from(self.tasks.values()).filter((t) => t.status === 'in_progress');
    },
    get doneTasks() {
      return Array.from(self.tasks.values()).filter((t) => t.status === 'done');
    },
    get usersList() {
      return Array.from(self.users.values());
    },
  }))
  .actions((self) => ({
    addUser(id: string, name: string) {
      self.users.put(User.create({ id, name }));
    },
    removeUser(id: string) {
      self.users.delete(id);
    },
    addTask(id: string, title: string, status: 'backlog' | 'todo' | 'in_progress' | 'done', assigneeId?: string) {
      self.tasks.put(Task.create({
        id,
        title,
        status,
        assignee: assigneeId,
      }));
    },
    removeTask(id: string) {
      self.tasks.delete(id);
    },
  }));

export type IKanbanBoard = Instance<typeof KanbanBoard>;
export type ITask = Instance<typeof Task>;
export type IUser = Instance<typeof User>;
