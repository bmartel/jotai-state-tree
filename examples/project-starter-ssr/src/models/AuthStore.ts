import { types, Instance } from 'jotai-state-tree';

export const AuthStore = types
  .model('AuthStore', {
    isAuthenticated: types.optional(types.boolean, false),
    currentUser: types.maybeNull(types.string),
  })
  .actions((self) => ({
    login(username: string) {
      if (username.trim()) {
        self.isAuthenticated = true;
        self.currentUser = username.trim();
      }
    },
    logout() {
      self.isAuthenticated = false;
      self.currentUser = null;
    },
  }));

export type IAuthStore = Instance<typeof AuthStore>;
