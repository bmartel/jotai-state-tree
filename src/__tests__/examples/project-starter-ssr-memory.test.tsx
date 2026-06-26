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
import { resetDevtoolsStore } from '../../devtools';
import { nodeRegistry } from '../../tree';
import { App } from '../../../examples/project-starter-ssr/src/App';


let originalEnv: string | undefined;

beforeEach(() => {
  originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  resetDevtoolsStore();
  clearAllRegistries();
  resetGlobalStore();
});

afterEach(() => {
  cleanup();
  resetDevtoolsStore();
  clearAllRegistries();
  resetGlobalStore();
  process.env.NODE_ENV = originalEnv;
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
    const runRenderBlock = async () => {
      const { unmount } = render(<App />);

      // Allow render effects and state trees to instantiate
      await Bun.sleep(50);

      // Verify nodes have been registered
      const activeStats = getRegistryStats();
      expect(activeStats.liveNodeCount).toBeGreaterThan(0);

      // 3. Unmount the App to release all references to the stores
      unmount();

      // Clear React's DOM / testing library cache
      cleanup();
    };

    await runRenderBlock();

    // 4. Force V8 Garbage Collection to collect dereferenced stores
    if (global.gc) {
      for (let i = 0; i < 10; i++) {
        await Bun.sleep(100);
        global.gc();
        cleanupStaleEntries();
        if (getRegistryStats().liveNodeCount === 0) {
          break;
        }
      }
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
