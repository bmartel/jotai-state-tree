import { describe, it, expect } from 'vitest';
import {
  types,
  getRoot,
  getParent,
  tryGetParent,
  getParentOfType,
  getPath,
  getPathParts,
  getEnv,
  clone,
  walk,
  cloneDeep,
  resolvePath,
  tryResolve,
  resolveIdentifier,
  getRelativePath,
  isAncestor,
  haveSameRoot,
  findAll,
  findFirst,
  isValidReference,
  getTreeStats,
  getType,
  isStateTreeNode,
  getOrCreatePath,
  freeze,
  isFrozen,
  unfreeze,
  unprotect,
  onPatch,
  destroy,
  applySnapshot,
  applyPatch,
  recordPatches,
  hasParent,
  isAlive,
  isRoot,
  getMembers,
  cleanupStaleEntries,
  getRegistryStats,
} from '../index';
import {
  $treenode,
  onLifecycleChange,
  getStateTreeNode,
  applySnapshotToNode,
  registerActionRecorderHook,
  getNodesOfType,
} from '../tree';

describe('Tree Utilities Extra', () => {
  const Child = types.model('Child', {
    id: types.identifier,
    name: types.string,
  });

  const Parent = types.model('Parent', {
    child: Child,
    otherChildren: types.array(Child),
  });

  it('tree navigation paths and parts', () => {
    const envObj = { test: 123 };
    const root = Parent.create({
      child: { id: 'c-1', name: 'alice' },
      otherChildren: [
        { id: 'c-2', name: 'bob' },
      ],
    }, envObj);

    expect(getRoot(root.child)).toBe(root);
    expect(getParent(root.child)).toBe(root);
    expect(tryGetParent(root.child)).toBe(root);
    expect(tryGetParent(root)).toBeUndefined();

    expect(getParentOfType(root.child, Parent)).toBe(root);
    expect(() => getParentOfType(root, Parent)).toThrow();

    expect(getPath(root.child)).toBe('/child');
    expect(getPathParts(root.child)).toEqual(['child']);

    expect(getEnv(root)).toBe(envObj);
  });

  it('clone and cloneDeep', () => {
    const root = Parent.create({
      child: { id: 'c-1', name: 'alice' },
      otherChildren: [],
    });

    const cloned = clone(root);
    expect(cloned).not.toBe(root);
    expect(cloned.child.name).toBe('alice');

    const deepCloned = cloneDeep(root);
    expect(deepCloned).not.toBe(root);
    expect(deepCloned.child.name).toBe('alice');
  });

  it('walk', () => {
    const root = Parent.create({
      child: { id: 'c-1', name: 'alice' },
      otherChildren: [
        { id: 'c-2', name: 'bob' },
      ],
    });

    const visited: string[] = [];
    walk(root, (node) => {
      visited.push(getType(node).name);
    });

    expect(visited).toContain('Parent');
    expect(visited).toContain('Child');
  });

  it('resolutions (resolvePath, tryResolve, resolveIdentifier)', () => {
    const root = Parent.create({
      child: { id: 'c-1', name: 'alice' },
      otherChildren: [
        { id: 'c-2', name: 'bob' },
      ],
    });

    const resolved = resolvePath(root, '/child');
    expect(resolved).toBe(root.child);

    const tryResolved = tryResolve(root, '/otherChildren/0');
    expect(tryResolved).toBe(root.otherChildren[0]);

    const tryResolvedFail = tryResolve(root, '/invalid/path');
    expect(tryResolvedFail).toBeUndefined();

    const resolvedIdNode = resolveIdentifier('Child', 'c-2');
    expect(resolvedIdNode).toBeDefined();
    expect(resolvedIdNode?.getInstance()).toBe(root.otherChildren[0]);
  });

  it('advanced tree comparisons and stats', () => {
    const root = Parent.create({
      child: { id: 'c-1', name: 'alice' },
      otherChildren: [
        { id: 'c-2', name: 'bob' },
      ],
    });

    expect(getRelativePath(root, root.child)).toBe('child');
    expect(getRelativePath(root.child, root.otherChildren[0])).toBe('../otherChildren/0');

    expect(isAncestor(root, root.child)).toBe(true);
    expect(isAncestor(root.child, root)).toBe(false);

    expect(haveSameRoot(root.child, root.otherChildren[0])).toBe(true);

    const allChildren = findAll(root, (n) => isStateTreeNode(n) && getType(n) === Child);
    expect(allChildren.length).toBe(2);

    const firstChild = findFirst(root, (n) => isStateTreeNode(n) && getType(n) === Child);
    expect(firstChild).toBe(root.child);

    expect(isValidReference(root.child, 'c-1')).toBe(true);

    const stats = getTreeStats(root);
    expect(stats.nodeCount).toBe(4); // Parent, child, otherChildren array, otherChildren[0]
  });

  it('getOrCreatePath, freeze, isFrozen, unfreeze', () => {
    const ParentWithMap = types.model('ParentWithMap', {
      childrenMap: types.map(Child),
    });
    const root = ParentWithMap.create({ childrenMap: {} });

    // Test getOrCreatePath
    const creator = () => Child.create({ id: 'c-2', name: 'bob' });
    const resolved = getOrCreatePath(root, 'childrenMap/c2', creator);
    expect(resolved).toBeDefined();
    expect(root.childrenMap.get('c2')?.name).toBe('bob');

    // Test getOrCreatePath errors
    expect(() => getOrCreatePath(root, 'invalidPath/999', () => ({}))).toThrow();
    expect(() => getOrCreatePath(root, 'childrenMap/c3', () => ({}))).toThrow('Creator must return a state tree node');

    // Test freeze / isFrozen / unfreeze
    expect(isFrozen(root)).toBe(false);
    freeze(root);
    expect(isFrozen(root)).toBe(true);
    expect(isFrozen(root.childrenMap)).toBe(true);

    unfreeze(root);
    expect(isFrozen(root)).toBe(false);
    expect(isFrozen(root.childrenMap)).toBe(false);
  });

  it('isValidReference catch block coverage', () => {
    const badTarget = {
      [$treenode]: {
        $type: {
          get name() {
            throw new Error('bad name');
          }
        }
      }
    };
    expect(isValidReference(badTarget, 'id')).toBe(false);
  });

  it('lifecycle change notifications', () => {
    const store = Child.create({ id: 'c-1', name: 'alice' });
    const node = store[$treenode];
    const listener = vi.fn();

    const dispose = onLifecycleChange(node, listener);
    // Trigger lifecycle change by destroying node
    destroy(store);

    expect(listener).toHaveBeenCalledWith(false);
    dispose();
  });

  it('cloneAndSerialize with Map values in patches', () => {
    const MapModel = types.model('MapModel', {
      state: types.frozen()
    });
    const store = MapModel.create({ state: null });
    unprotect(store);

    const patchSpy = vi.fn();
    onPatch(store, patchSpy);

    store.state = new Map([['k1', 'v1']]);
    expect(patchSpy).toHaveBeenCalled();
    const patch = patchSpy.mock.calls[0][0];
    expect(patch.value).toEqual({ k1: 'v1' });
  });

  it('setValue throws on dead node and removeChild execution', () => {
    const store = Parent.create({
      child: { id: 'c-1', name: 'alice' },
      otherChildren: [],
    });
    const node = store[$treenode];
    const childNode = store.child[$treenode];

    // Remove child
    node.removeChild('child');
    expect(node.getChild('child')).toBeUndefined();

    // Set value on dead child node should throw
    expect(() => childNode.setValue('new-val')).toThrow(
      "[jotai-state-tree] Cannot modify a node that is no longer part of the state tree."
    );
  });
});

describe('Tree Finalization registry simulation', () => {
  it('should clean up registries when GC finalizer triggers', async () => {
    let finalizerCallback: any = null;
    class MockFinalizationRegistry {
      constructor(callback: any) {
        finalizerCallback = callback;
      }
      register() {}
      unregister() {}
    }

    let shouldDerefFail = false;
    class MockWeakRef {
      target: any;
      constructor(target: any) {
        this.target = target;
      }
      deref() {
        return shouldDerefFail ? undefined : this.target;
      }
    }

    vi.stubGlobal('FinalizationRegistry', MockFinalizationRegistry);
    vi.stubGlobal('WeakRef', MockWeakRef);
    vi.resetModules();

    const { types: localTypes, resolveIdentifier: localResolveId } = await import('../index');
    const { registerModel } = await import('../registry');

    const Target = localTypes.model('FinalizeTarget', {
      id: localTypes.identifier,
    });
    registerModel('FinalizeTarget', Target);

    const inst = Target.create({ id: 'f-1' });

    // Verify it is registered in identifierRegistry
    expect(localResolveId('FinalizeTarget', 'f-1')).toBeDefined();

    // Simulate GC callback
    expect(finalizerCallback).toBeTypeOf('function');
    shouldDerefFail = true;
    finalizerCallback({ typeName: 'FinalizeTarget', identifier: 'f-1' });

    // Verify it is deleted from registry
    expect(localResolveId('FinalizeTarget', 'f-1')).toBeUndefined();
    
    vi.unstubAllGlobals();
  });

  it('cleanupStaleEntries cleans up stale entries in registries', async () => {
    let shouldDerefFail = false;
    class MockWeakRef {
      target: any;
      constructor(target: any) {
        this.target = target;
      }
      deref() {
        return shouldDerefFail ? undefined : this.target;
      }
    }
    vi.stubGlobal('WeakRef', MockWeakRef);
    vi.resetModules();

    const { types: localTypes, cleanupStaleEntries: localCleanup, getRegistryStats: localStats } = await import('../index');
    const Target = localTypes.model('StaleTarget', {
      id: localTypes.identifier,
    });
    const inst = Target.create({ id: 's-1' });

    // With shouldDerefFail = false, cleanup should do nothing
    expect(localCleanup()).toBe(0);

    // With shouldDerefFail = true, cleanup should clean up the stale node and identifier
    shouldDerefFail = true;
    expect(localStats().staleNodeCount).toBeGreaterThan(0);
    expect(localCleanup()).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });
});

describe('Tree Utilities Additional Coverage', () => {
  const Child = types.model('ChildAdditional', {
    id: types.identifier,
    name: types.string,
  });

  const Parent = types.model('ParentAdditional', {
    child: Child,
    otherChildren: types.array(Child),
  });

  it('getStateTreeNode exceptions and node alive/root checks', () => {
    expect(() => getStateTreeNode(null)).toThrow("[jotai-state-tree] Value is not a state tree node");
    expect(() => getStateTreeNode({})).toThrow("[jotai-state-tree] Value is not a state tree node");

    expect(isAlive({})).toBe(false);

    const root = Parent.create({
      child: { id: 'c-1', name: 'alice' },
      otherChildren: [],
    });
    expect(isRoot(root)).toBe(true);
    expect(isRoot(root.child)).toBe(false);
  });

  it('hasParent traversal', () => {
    const root = Parent.create({
      child: { id: 'c-1', name: 'alice' },
      otherChildren: [],
    });
    expect(hasParent(root.child, 1)).toBe(true);
    expect(hasParent(root.child, 2)).toBe(false);
    expect(hasParent(root, 1)).toBe(false);
  });

  it('getParentOfType multiple levels', () => {
    const GrandChild = types.model('GrandChild', { id: types.identifier });
    const Middle = types.model('Middle', { grandchild: GrandChild });
    const GrandParent = types.model('GrandParent', { middle: Middle });

    const gp = GrandParent.create({
      middle: { grandchild: { id: 'gc-1' } }
    });
    const gc = gp.middle.grandchild;
    expect(getParentOfType(gc, GrandParent)).toBe(gp);
    expect(() => getParentOfType(gc, Parent)).toThrow("[jotai-state-tree] No parent of type 'ParentAdditional' found");
  });

  it('applySnapshotToNode boundary cases', () => {
    const store = Parent.create({
      child: { id: 'c-1', name: 'alice' },
      otherChildren: [],
    });
    unprotect(store);

    const deadChild = store.child;
    destroy(deadChild);
    expect(() => applySnapshot(deadChild, { id: 'c-1', name: 'bob' })).toThrow("[jotai-state-tree] Cannot apply snapshot to a dead node");

    const PreProcessedModel = types.model('PreProcessedModel', {
      value: types.string,
    }).preProcessSnapshot((snapshot: any) => {
      return { value: (snapshot.value || '').toUpperCase() };
    });
    const ppm = PreProcessedModel.create({ value: 'hello' });
    applySnapshot(ppm, { value: 'world' });
    expect(ppm.value).toBe('WORLD');

    // Missing mstArray and mstMap node instance scenarios
    const mockArrayNode = {
      $isAlive: true,
      $type: { _kind: 'array' },
      getInstance: () => null,
      setValue: vi.fn(),
    } as any;
    applySnapshotToNode(mockArrayNode, [1, 2, 3]);
    expect(mockArrayNode.setValue).toHaveBeenCalledWith([1, 2, 3]);

    const mockMapNode = {
      $isAlive: true,
      $type: { _kind: 'map' },
      getInstance: () => null,
      setValue: vi.fn(),
    } as any;
    applySnapshotToNode(mockMapNode, { a: 1 });
    expect(mockMapNode.setValue).toHaveBeenCalledWith({ a: 1 });
  });

  it('getNodesOfType retrieval', () => {
    const store = Parent.create({
      child: { id: 'c-2', name: 'alice' },
      otherChildren: [],
    });
    const nodes = getNodesOfType('ChildAdditional');
    expect(nodes.length).toBeGreaterThan(0);
    expect(getNodesOfType('NonExistentTypeName')).toEqual([]);
  });

  it('applyPatch edge cases for Array, Map and raw values', () => {
    const PatchModel = types.model('PatchModel', {
      arr: types.array(types.number),
      map: types.map(types.string),
      prim: types.string,
    });
    const pmInstance = PatchModel.create({
      arr: [1, 2],
      map: { k: 'v' },
      prim: 'hello',
    });
    unprotect(pmInstance);

    // replace on array
    applyPatch(pmInstance, { op: 'replace', path: '/arr/1', value: 99 });
    expect(pmInstance.arr[1]).toBe(99);

    // replace on map
    applyPatch(pmInstance, { op: 'replace', path: '/map/k', value: 'new-v' });
    expect(pmInstance.map.get('k')).toBe('new-v');

    // replace on primitive
    applyPatch(pmInstance, { op: 'replace', path: '/prim', value: 'world' });
    expect(pmInstance.prim).toBe('world');

    // invalid path error
    expect(() => applyPatch(pmInstance, { op: 'replace', path: '/nonExistent/child', value: 123 })).toThrow(
      "[jotai-state-tree] Invalid patch path: /nonExistent/child"
    );

    // add to array instance
    applyPatch(pmInstance, { op: 'add', path: '/arr/1', value: 50 });
    expect([...pmInstance.arr]).toEqual([1, 50, 99]);

    // add to map instance
    applyPatch(pmInstance, { op: 'add', path: '/map/newKey', value: 'newVal' });
    expect(pmInstance.map.get('newKey')).toBe('newVal');

    // remove from array instance
    applyPatch(pmInstance, { op: 'remove', path: '/arr/1' });
    expect([...pmInstance.arr]).toEqual([1, 99]);

    // remove from map instance
    applyPatch(pmInstance, { op: 'remove', path: '/map/newKey' });
    expect(pmInstance.map.has('newKey')).toBe(false);

    // Mock node with raw array/object currentValue
    const mockArrayNode = {
      $isAlive: true,
      getInstance: () => null,
      getValue: () => [10, 20],
      setValue: vi.fn(),
      getChild: () => null,
      getRoot: function() { return this; },
    } as any;
    const arrayWrapper = { [$treenode]: mockArrayNode };

    applyPatch(arrayWrapper, { op: 'add', path: '/-', value: 30 });
    expect(mockArrayNode.setValue).toHaveBeenCalledWith([10, 20, 30]);

    applyPatch(arrayWrapper, { op: 'add', path: '/1', value: 15 });
    expect(mockArrayNode.setValue).toHaveBeenCalledWith([10, 15, 20]);

    applyPatch(arrayWrapper, { op: 'remove', path: '/1' });
    expect(mockArrayNode.setValue).toHaveBeenCalledWith([10]);

    const mockObjectNode = {
      $isAlive: true,
      getInstance: () => null,
      getValue: () => ({ a: 1 }),
      setValue: vi.fn(),
      getChild: () => null,
      getRoot: function() { return this; },
    } as any;
    const objectWrapper = { [$treenode]: mockObjectNode };

    applyPatch(objectWrapper, { op: 'add', path: '/b', value: 2 });
    expect(mockObjectNode.setValue).toHaveBeenCalledWith({ a: 1, b: 2 });

    applyPatch(objectWrapper, { op: 'remove', path: '/a' });
    expect(mockObjectNode.setValue).toHaveBeenCalledWith({});
  });

  it('recordPatches and controls', () => {
    const PatchModel = types.model('PatchModelRecord', {
      prim: types.string,
    });
    const pmInstance = PatchModel.create({ prim: '' });
    unprotect(pmInstance);

    const recorder = recordPatches(pmInstance);

    pmInstance.prim = 'abc';
    recorder.stop();
    pmInstance.prim = 'def'; // ignored
    recorder.resume();
    pmInstance.prim = 'ghi';

    expect(recorder.patches.map(p => p.value)).toEqual(['abc']);

    const pmInstanceReplay = PatchModel.create({ prim: '' });
    unprotect(pmInstanceReplay);
    recorder.replay(pmInstanceReplay);
    expect(pmInstanceReplay.prim).toBe('abc');

    recorder.undo(pmInstanceReplay);
    expect(pmInstanceReplay.prim).toBe('');
  });

  it('registerActionRecorderHook and disposer', () => {
    const ActionRecorderModel = types.model('ActionRecorderModel', {
      value: types.string,
    }).actions(self => ({
      setValue(v: string) {
        self.value = v;
      }
    }));
    const armInstance = ActionRecorderModel.create({ value: '' });
    const hookSpy = vi.fn();
    const disposeHook = registerActionRecorderHook(hookSpy);
    armInstance.setValue('hello');
    expect(hookSpy).toHaveBeenCalled();
    disposeHook();
    disposeHook(); // noop
  });

  it('getMembers traversal', () => {
    const MemberModel = types.model('MemberModel', {
      prop1: types.string,
    }).volatile(self => ({
      vol1: 'volatileValue'
    }));
    const memberInstance = MemberModel.create({ prop1: 'propValue' });
    const members = getMembers(memberInstance);
    expect(members).toContainEqual({ name: 'prop1', type: 'property', value: 'propValue' });
    expect(members).toContainEqual({ name: 'vol1', type: 'volatile', value: 'volatileValue' });
  });

  it('getRelativePath with common path segment', () => {
    const DeepChild = types.model('DeepChild', { id: types.identifier });
    const RelChild = types.model('RelChild', {
      subChild: DeepChild,
      otherChild: DeepChild,
    });
    const RelParentDeep = types.model('RelParentDeep', {
      child: RelChild,
    });
    const relRootDeep = RelParentDeep.create({
      child: {
        subChild: { id: 's' },
        otherChild: { id: 'o' },
      }
    });
    expect(getRelativePath(relRootDeep.child.subChild, relRootDeep.child.otherChild)).toBe('../otherChild');
  });

  it('isValidReference checks', () => {
    expect(isValidReference({}, 'some-id')).toBe(false);
  });

  it('getTreeStats early exit walk', () => {
    const mockChildNode = {
      $isAlive: true,
      $path: '/child',
      $type: { name: 'ChildType' },
      getInstance: () => ({}),
      getChildren: () => [],
    } as any;
    const mockRootNode = {
      $isAlive: true,
      $path: '',
      $type: { name: 'RootType' },
      getInstance: () => inst,
      getChildren: () => [mockChildNode],
    } as any;
    const inst = {
      [$treenode]: mockRootNode,
    };

    const stats = getTreeStats(inst);
    expect(stats.nodeCount).toBe(1);
  });
});



