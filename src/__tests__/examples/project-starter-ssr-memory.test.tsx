/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  clearAllRegistries,
  resetGlobalStore,
  getRegistryStats,
  cleanupStaleEntries,
} from '../../index';
import { nodeRegistry } from '../../tree';
import { App } from '../../../examples/project-starter-ssr/src/App';

vi.mock('jotai-state-tree/devtools', () => ({
  JotaiStateTreeDevtools: () => null,
}));

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
});

describe('Project Starter SSR Memory Leak Audit', () => {
  it('should garbage collect all state tree nodes when App is unmounted', async () => {
    // 1. Ensure registry is completely clean at start
    clearAllRegistries();
    if (global.gc) {
      global.gc();
    }
    cleanupStaleEntries();

    const initialStats = getRegistryStats();
    expect(initialStats.liveNodeCount).toBe(0);

    // 2. Render the project starter App (which instantiates the stores)
    const { unmount } = render(<App />);

    // Allow render effects and state trees to instantiate
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify nodes have been registered
    const activeStats = getRegistryStats();
    expect(activeStats.liveNodeCount).toBeGreaterThan(0);

    // 3. Unmount the App to release all references to the stores
    unmount();

    // Clear React's DOM / testing library cache
    cleanup();

    // 4. Force V8 Garbage Collection to collect dereferenced stores
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (global.gc) {
      global.gc();
      cleanupStaleEntries();
    }

    // 5. Verify that all nodes are garbage collected and cleaned up
    const finalStats = getRegistryStats();
    if (finalStats.liveNodeCount > 0) {
      console.log('--- LEAKING NODES IN REGISTRY ---');
      for (const [id, entry] of nodeRegistry.entries()) {
        const node = entry.node.deref();
        if (node) {
          console.log(`Node: ID=${id}, Path=${node.$path}, Type=${node.$type?.name}`);
        } else {
          console.log(`Node: ID=${id} (WeakRef already dereferenced to undefined but not finalized)`);
        }
      }
    }

    if (global.gc) {
      expect(finalStats.liveNodeCount).toBe(0);
    } else {
      console.warn('global.gc is not available. Please run with --expose-gc.');
    }
  });
});
