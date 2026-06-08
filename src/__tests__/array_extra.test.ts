import { describe, it, expect } from 'vitest';
import { types } from '../index';

describe('MST Array Operations Extra', () => {
  const Item = types.model('Item', {
    id: types.identifier,
    name: types.string,
  });

  const Store = types.model('Store', {
    items: types.array(Item),
  });

  it('unshift', () => {
    const store = Store.create({
      items: [{ id: '1', name: 'first' }],
    });

    const len = store.items.unshift({ id: '0', name: 'zero' });
    expect(len).toBe(2);
    expect(store.items[0].id).toBe('0');
    expect(store.items[1].id).toBe('1');
  });

  it('splice', () => {
    const store = Store.create({
      items: [
        { id: '1', name: 'first' },
        { id: '2', name: 'second' },
        { id: '3', name: 'third' },
      ],
    });

    // Splice out middle item, insert new one
    const deleted = store.items.splice(1, 1, { id: '4', name: 'fourth' });
    expect(deleted.length).toBe(1);
    expect(deleted[0].id).toBe('2');
    expect(store.items.length).toBe(3);
    expect(store.items[0].id).toBe('1');
    expect(store.items[1].id).toBe('4');
    expect(store.items[2].id).toBe('3');
  });

  it('fill', () => {
    const IntStore = types.model({
      numbers: types.array(types.number),
    });
    const s = IntStore.create({ numbers: [1, 2, 3, 4] });

    s.numbers.fill(9, 1, 3);
    expect(s.numbers.toJSON()).toEqual([1, 9, 9, 4]);

    s.numbers.fill(0);
    expect(s.numbers.toJSON()).toEqual([0, 0, 0, 0]);
  });

  it('replace', () => {
    const store = Store.create({
      items: [{ id: '1', name: 'first' }],
    });

    store.items.replace([
      { id: '2', name: 'second' },
      { id: '3', name: 'third' },
    ]);

    expect(store.items.length).toBe(2);
    expect(store.items[0].id).toBe('2');
    expect(store.items[1].id).toBe('3');
  });

  it('clear', () => {
    const store = Store.create({
      items: [{ id: '1', name: 'first' }],
    });

    store.items.clear();
    expect(store.items.length).toBe(0);
  });

  it('remove', () => {
    const store = Store.create({
      items: [
        { id: '1', name: 'first' },
        { id: '2', name: 'second' },
      ],
    });

    const secondItem = store.items[1];
    const removedTrue = store.items.remove(secondItem);
    expect(removedTrue).toBe(true);
    expect(store.items.length).toBe(1);

    const removedFalse = store.items.remove(secondItem); // already removed
    expect(removedFalse).toBe(false);
  });

  it('spliceWithArray', () => {
    const store = Store.create({
      items: [
        { id: '1', name: 'first' },
        { id: '2', name: 'second' },
      ],
    });

    const deleted = store.items.spliceWithArray(1, 1, [{ id: '3', name: 'third' }]);
    expect(deleted.length).toBe(1);
    expect(deleted[0].id).toBe('2');
    expect(store.items.length).toBe(2);
    expect(store.items[1].id).toBe('3');
  });

  it('toJSON and iterator', () => {
    const store = Store.create({
      items: [{ id: '1', name: 'first' }],
    });

    expect(store.items.toJSON()).toEqual([{ id: '1', name: 'first' }]);

    const itemsArr = Array.from(store.items);
    expect(itemsArr.length).toBe(1);
    expect(itemsArr[0].name).toBe('first');
  });

  it('validation errors', () => {
    expect(() => Store.create({
      items: [{ id: '1', name: 123 as any }] // invalid name
    })).toThrow();
  });
});
