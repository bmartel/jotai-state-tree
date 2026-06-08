import { describe, it, expect } from 'vitest';
import { types } from '../index';

describe('MST Map Operations Extra', () => {
  const User = types.model('User', {
    id: types.identifier,
    name: types.string,
  });

  const Group = types.model('Group', {
    users: types.map(User),
  });

  it('put', () => {
    const group = Group.create({ users: {} });
    const userSnapshot = { id: 'user-1', name: 'Alice' };
    const returnedUser = group.users.put(userSnapshot);

    expect(returnedUser).toBeDefined();
    expect(returnedUser.name).toBe('Alice');
    expect(group.users.get('user-1')).toBe(returnedUser);
  });

  it('merge', () => {
    const group = Group.create({
      users: {
        'user-1': { id: 'user-1', name: 'Alice' },
      },
    });

    group.users.merge({
      'user-2': { id: 'user-2', name: 'Bob' },
      'user-1': { id: 'user-1', name: 'Alice Cooper' },
    });

    expect(group.users.size).toBe(2);
    expect(group.users.get('user-1')?.name).toBe('Alice Cooper');
    expect(group.users.get('user-2')?.name).toBe('Bob');
  });

  it('replace', () => {
    const group = Group.create({
      users: {
        'user-1': { id: 'user-1', name: 'Alice' },
      },
    });

    group.users.replace({
      'user-3': { id: 'user-3', name: 'Charlie' },
    });

    expect(group.users.size).toBe(1);
    expect(group.users.has('user-1')).toBe(false);
    expect(group.users.get('user-3')?.name).toBe('Charlie');
  });

  it('clear and delete', () => {
    const group = Group.create({
      users: {
        'user-1': { id: 'user-1', name: 'Alice' },
        'user-2': { id: 'user-2', name: 'Bob' },
      },
    });

    const deleted = group.users.delete('user-1');
    expect(deleted).toBe(true);
    expect(group.users.size).toBe(1);

    group.users.clear();
    expect(group.users.size).toBe(0);
  });

  it('iterators and toJSON', () => {
    const group = Group.create({
      users: {
        'user-1': { id: 'user-1', name: 'Alice' },
        'user-2': { id: 'user-2', name: 'Bob' },
      },
    });

    const keys = Array.from(group.users.keys());
    expect(keys).toEqual(['user-1', 'user-2']);

    const values = Array.from(group.users.values());
    expect(values.length).toBe(2);
    expect(values[0].name).toBe('Alice');

    const entries = Array.from(group.users.entries());
    expect(entries.length).toBe(2);
    expect(entries[0][0]).toBe('user-1');
    expect(entries[0][1].name).toBe('Alice');

    expect(group.users.toJSON()).toEqual({
      'user-1': { id: 'user-1', name: 'Alice' },
      'user-2': { id: 'user-2', name: 'Bob' },
    });
  });

  it('validation errors', () => {
    expect(() => Group.create({
      users: {
        'user-1': { id: 'user-1', name: 123 as any } // invalid name
      }
    })).toThrow();
  });
});
