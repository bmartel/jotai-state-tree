import { describe, it, expect } from 'vitest';
import { types, unprotect, destroy } from '../index';
import { getStateTreeNode } from '../tree';

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
    const MSTArray = arr.constructor;
    const node = getStateTreeNode(arr);
    
    // Destroy the parent node, killing the array
    destroy(store);

    expect(() => arr[0]).toThrow("[jotai-state-tree] Cannot access array - the node is dead.");
    expect(() => {
      arr[0] = 5;
    }).toThrow("[jotai-state-tree] Cannot modify array - the node is dead.");
    
    expect(() => {
      arr.push(3);
    }).toThrow("[jotai-state-tree] Cannot access array - the node is dead.");

    // Direct instantiation with dead node to test checkWrite dead node check
    const rawMstArray = new (MSTArray as any)(node, types.number, []);
    expect(() => {
      rawMstArray.push(3);
    }).toThrow("[jotai-state-tree] Cannot modify array - the node is dead.");
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

  it('array additional edge cases and branch coverage', () => {
    // 1. types.array creation without snapshot
    const StringArrayType = types.array(types.string);
    const emptyArray = StringArrayType.create();
    expect(emptyArray.toJSON()).toEqual([]);

    // 2. spliceWithArray boundaries
    const NumStore = types.model({
      numbers: types.array(types.number),
    });
    const s = NumStore.create({ numbers: [10, 20, 30] });
    unprotect(s);
    // deleteCount === undefined
    const res1 = s.numbers.spliceWithArray(1);
    expect([...res1]).toEqual([20, 30]);
    expect(s.numbers.toJSON()).toEqual([10]);

    // newItems === undefined
    const s2 = NumStore.create({ numbers: [10, 20, 30] });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    unprotect(s2);
    const res2 = s2.numbers.spliceWithArray(1, 1);
    expect([...res2]).toEqual([20]);
    expect(s2.numbers.toJSON()).toEqual([10, 30]);

    // 3. splice override with deleteCount === undefined
    const s3 = NumStore.create({ numbers: [10, 20, 30] });
    unprotect(s3);
    const res3 = s3.numbers.splice(1);
    expect([...res3]).toEqual([20, 30]);
    expect(s3.numbers.toJSON()).toEqual([10]);

    // 4. Primitive item reuse reconciliation ([1, 2] -> [2, 1])
    const s4 = NumStore.create({ numbers: [1, 2] });
    unprotect(s4);
    s4.numbers.replace([2, 1]);
    expect(s4.numbers.toJSON()).toEqual([2, 1]);

    // 5. Nested array validation path check
    const NestedModel = types.model({
      arr: types.array(types.string),
    });
    const valRes = NestedModel.validate({ arr: [123 as any] }, []);
    expect(valRes.valid).toBe(false);
    expect(valRes.errors[0].context[valRes.errors[0].context.length - 1].path).toBe('/arr/0');

    // 6. Reconciliation for optional/maybe/refinement item type
    const MaybeModel = types.model({
      items: types.array(types.maybe(Item)),
    });
    const sMaybe = MaybeModel.create({
      items: [{ id: '1', name: 'alice' }],
    });
    unprotect(sMaybe);
    sMaybe.items.replace([{ id: '1', name: 'bob' }]);
    expect(sMaybe.items[0]?.name).toBe('bob');

    // 7. Adding new items with valid/invalid identifiers into a complex array where identifierAttribute is defined
    const customIdentifier: any = {
      name: 'custom-identifier',
      _kind: 'identifier',
      create(snapshot: any) {
        return snapshot;
      },
      is(value: any) {
        return true;
      },
      validate(value: any) {
        return { valid: true, errors: [] };
      },
      describe() {
        return 'custom-identifier';
      }
    };
    const CustomIdItem = types.model('CustomIdItem', {
      id: customIdentifier,
      name: types.string,
    });
    const CustomStore = types.model('CustomStore', {
      items: types.array(CustomIdItem),
    });
    const sIdent = CustomStore.create({
      items: [{ id: '1', name: 'alice' }],
    });
    unprotect(sIdent);
    sIdent.items.push({ id: '2', name: 'bob' });
    expect(sIdent.items[1].name).toBe('bob');

    // id is undefined
    sIdent.items.push({ name: 'charlie' } as any);
    expect(sIdent.items[2].name).toBe('charlie');

    // id is null
    sIdent.items.push({ id: null, name: 'dave' } as any);
    expect(sIdent.items[3].name).toBe('dave');

    // 8. Modifying a destroyed array node (should throw)
    const storeToDestroy = NumStore.create({ numbers: [1, 2] });
    const numbersToDestroy = storeToDestroy.numbers;
    destroy(storeToDestroy);
    expect(() => { numbersToDestroy[0] = 99; }).toThrow('[jotai-state-tree] Cannot modify array - the node is dead.');

    // 9. getValue/getChild mock fallback checks in syncToNode and patch generation
    const sMock = NumStore.create({ numbers: [10, 20] });
    unprotect(sMock);
    const node = getStateTreeNode(sMock.numbers);

    // getValue returns null
    const spyVal = vi.spyOn(node, 'getValue').mockReturnValueOnce(null);
    sMock.numbers.push(30);
    spyVal.mockRestore();

    // old snapshots getChild returns undefined
    const spyChild1 = vi.spyOn(node, 'getChild').mockReturnValue(undefined);
    sMock.numbers.push(40);
    spyChild1.mockRestore();

    // simple push getChild returns undefined for new index
    const spyChild2 = vi.spyOn(node, 'getChild').mockImplementation((key) => {
      if (key === '4') return undefined; // index of pushed 50 (numbers length was 4)
      return node.getChildren().get(key);
    });
    sMock.numbers.push(50);
    spyChild2.mockRestore();

    // fallback mutation getChild returns undefined for index
    const spyChild3 = vi.spyOn(node, 'getChild').mockImplementation((key) => {
      if (key === '0') return undefined;
      return node.getChildren().get(key);
    });
    sMock.numbers.splice(0, 1, 99);
    spyChild3.mockRestore();

    // 10. Nullable identifier in array item type
    const NullableIdItem = types.model({
      id: types.maybeNull(types.identifier),
      name: types.string,
    });
    const NullableStore = types.model({
      items: types.array(NullableIdItem),
    }).create({
      items: [{ id: '1', name: 'alice' }],
    });
    unprotect(NullableStore);
    NullableStore.items.push({ id: null, name: 'bob' });
    expect(NullableStore.items[1].id).toBeNull();

    // 11. Union array triggering primitive node reuse on index shift
    const UnionArray = types.array(types.union(types.number, types.string));
    const sUnion = types.model({ arr: UnionArray }).create({ arr: [2] });
    unprotect(sUnion);
    sUnion.arr.replace(['3', 2]);
    expect(sUnion.arr.toJSON()).toEqual(['3', 2]);
  });
});

