import { describe, it, expect } from 'vitest';
import { types, getPath, detach } from '../index';
import { getStateTreeNode } from '../tree';

describe('Path Resolution Cache', () => {
  const Child = types.model('Child', {
    id: types.identifier,
    name: types.string,
  });

  const Parent = types.model('Parent', {
    id: types.identifier,
    children: types.array(Child),
  }).actions((self) => ({
    addChild(child: any) {
      self.children.push(child);
    },
  }));

  const Root = types.model('Root', {
    parentA: Parent,
    parentB: Parent,
  });

  it('correctly resolves paths and cachedPath properties', () => {
    const root = Root.create({
      parentA: { id: 'A', children: [{ id: 'c1', name: 'Child 1' }] },
      parentB: { id: 'B', children: [] },
    });

    const child1 = root.parentA.children[0];
    const child1Node = getStateTreeNode(child1);

    // Initial path check
    expect(getPath(child1)).toBe('/parentA/children/0');
    expect(child1Node.cachedPath).toBe('/parentA/children/0');

    // Move child to parentB
    const detachedChild = detach(child1);
    const detachedChildNode = getStateTreeNode(detachedChild);

    // Detached path should be empty
    expect(getPath(detachedChild)).toBe('');
    expect(detachedChildNode.cachedPath).toBe('');

    // Reattach to parentB
    root.parentB.addChild(detachedChild);

    // Path should update to parentB
    expect(getPath(detachedChild)).toBe('/parentB/children/0');
    expect(detachedChildNode.cachedPath).toBe('/parentB/children/0');
  });

  it('handles deep path recursion updates correctly', () => {
    const DeepChild = types.model('DeepChild', {
      name: types.string,
    });
    const Inner = types.model('Inner', {
      deep: DeepChild,
    });
    const Middle = types.model('Middle', {
      inner: Inner,
    });
    const Top = types.model('Top', {
      middle: Middle,
    });

    const top = Top.create({
      middle: {
        inner: {
          deep: { name: 'leaf' },
        },
      },
    });

    const leafNode = getStateTreeNode(top.middle.inner.deep);
    expect(getPath(top.middle.inner.deep)).toBe('/middle/inner/deep');
    expect(leafNode.cachedPath).toBe('/middle/inner/deep');
  });
});
