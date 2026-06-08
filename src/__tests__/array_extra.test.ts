import { describe, it, expect } from 'vitest';
import { types, unprotect, destroy } from '../index';

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
    unprotect(store);

    const len = store.items.unshift({ id: '0', name: 'zero' });
    expect(len).toBe(2);
    expect(store.items[0].id).toBe('0');
    expect(store.items[1].id).toBe('1');
  });

  it('splice', () => {
    const NumStore = types.model({
      numbers: types.array(types.number),
    });
    const store = NumStore.create({
      numbers: [1, 2, 3],
    });
    unprotect(store);

    const deleted = store.numbers.splice(1, 1, 4);
    expect(Array.from(deleted)).toEqual([2]);
    expect(store.numbers.toJSON()).toEqual([1, 4, 3]);
  });

  it('fill', () => {
    const IntStore = types.model({
      numbers: types.array(types.number),
    });
    const s = IntStore.create({ numbers: [1, 2, 3, 4] });
    unprotect(s);

    s.numbers.fill(9, 1, 3);
    expect(s.numbers.toJSON()).toEqual([1, 9, 9, 4]);

    s.numbers.fill(0);
    expect(s.numbers.toJSON()).toEqual([0, 0, 0, 0]);
  });

  it('replace', () => {
    const store = Store.create({
      items: [{ id: '1', name: 'first' }],
    });
    unprotect(store);

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
    unprotect(store);

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
    unprotect(store);

    const secondItem = store.items[1];
    const removedTrue = store.items.remove(secondItem);
    expect(removedTrue).toBe(true);
    expect(store.items.length).toBe(1);

    const removedFalse = store.items.remove(secondItem); // already removed
    expect(removedFalse).toBe(false);
  });

  it('spliceWithArray', () => {
    const NumStore = types.model({
      numbers: types.array(types.number),
    });
    const store = NumStore.create({
      numbers: [1, 2],
    });
    unprotect(store);

    const deleted = store.numbers.spliceWithArray(1, 1, [3]);
    expect(Array.from(deleted)).toEqual([2]);
    expect(store.numbers.toJSON()).toEqual([1, 3]);
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

  it('pop and shift', () => {
    const NumStore = types.model({
      numbers: types.array(types.number),
    });
    const store = NumStore.create({
      numbers: [1, 2, 3],
    });
    unprotect(store);

    const popped = store.numbers.pop();
    expect(popped).toBe(3);
    expect(store.numbers.toJSON()).toEqual([1, 2]);

    const shifted = store.numbers.shift();
    expect(shifted).toBe(1);
    expect(store.numbers.toJSON()).toEqual([2]);
  });

  it('sort and reverse', () => {
    const NumStore = types.model({
      numbers: types.array(types.number),
    });
    const store = NumStore.create({
      numbers: [3, 1, 2],
    });
    unprotect(store);

    store.numbers.sort();
    expect(store.numbers.toJSON()).toEqual([1, 2, 3]);

    store.numbers.reverse();
    expect(store.numbers.toJSON()).toEqual([3, 2, 1]);
  });

  it('copyWithin', () => {
    const NumStore = types.model({
      numbers: types.array(types.number),
    });
    const store = NumStore.create({
      numbers: [1, 2, 3, 4],
    });
    unprotect(store);

    store.numbers.copyWithin(0, 2, 4);
    expect(store.numbers.toJSON()).toEqual([3, 4, 3, 4]);
  });

  it('primitive value reuse reconciliation', () => {
    const NumStore = types.model({
      numbers: types.array(types.number),
    });
    const store = NumStore.create({
      numbers: [1, 2, 3],
    });
    unprotect(store);

    // This triggers syncToNode and reconciles the primitive values,
    // reusing the primitive nodes for existing values (like 1 and 2).
    store.numbers.replace([1, 2, 4]);
    expect(store.numbers.toJSON()).toEqual([1, 2, 4]);
  });

  it('dead node access and mutation checks', () => {
    const NumStore = types.model({
      numbers: types.array(types.number),
    });
    const store = NumStore.create({
      numbers: [1, 2],
    });
    
    // Grab reference to array before destroy
    const arr = store.numbers;
    
    // Destroy the parent node, killing the array
    destroy(store);

    expect(() => arr[0]).toThrow("[jotai-state-tree] Cannot access array - the node is dead.");
    expect(() => {
      arr[0] = 5;
    }).toThrow("[jotai-state-tree] Cannot modify array - the node is dead.");
    
    expect(() => {
      arr.push(3);
    }).toThrow("[jotai-state-tree] Cannot access array - the node is dead.");

  });

  it('validation errors', () => {
    expect(() => Store.create({
      items: [{ id: '1', name: 123 as any }] // invalid name
    })).toThrow();
  });

  it('ArrayType is and validate methods', () => {
    const ArrayType = types.array(types.string);
    expect(ArrayType.is([])).toBe(false); // not state tree node yet
    expect(ArrayType.is(123)).toBe(false);

    expect(ArrayType.validate(123, []).valid).toBe(false);
    
    const validResult = ArrayType.validate(['a', 'b'], []);
    expect(validResult.valid).toBe(true);

    const invalidResult = ArrayType.validate([123 as any], []);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBe(1);
  });
});

