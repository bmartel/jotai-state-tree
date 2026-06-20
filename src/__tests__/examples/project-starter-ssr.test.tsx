/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { clearAllRegistries, resetGlobalStore, onPatch, applySnapshot } from '../../index';
import { App } from '../../../examples/project-starter-ssr/src/App';
import { createAppStore } from '../../../examples/project-starter-ssr/src/models/RootStore';

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();

  // Mock server actions for SSR endpoint /api/_jst_action
  vi.spyOn(global, 'fetch').mockImplementation(async (input: any, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : (input as any)?.url || '';
    if (urlStr.includes('/api/_jst_action')) {
      const body = JSON.parse(init?.body as string || '{}');
      const { actionName, args, clientSnapshot } = body;
      
      const tempStore = createAppStore();
      applySnapshot(tempStore, clientSnapshot);
      
      const patches: any[] = [];
      const dispose = onPatch(tempStore, (patch) => {
        patches.push(patch);
      });
      
      let result: any = { success: true };
      if (actionName === 'toggleTask') {
        const task = tempStore.tasks.items.find((t: any) => t.id === args.id);
        if (task) {
          task.toggle();
        } else {
          result = { success: false, error: 'Task not found' };
        }
      } else if (actionName === 'addTask') {
        tempStore.tasks.addTask(args.title, args.category);
      } else if (actionName === 'deleteTask') {
        tempStore.tasks.deleteTask(args.id);
      }
      
      dispose();
      
      return {
        ok: true,
        json: async () => ({
          result,
          patches,
        }),
      } as Response;
    }
    
    return {
      ok: true,
      json: async () => ({}),
    } as Response;
  });
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
  vi.restoreAllMocks();
});

describe('Project Starter SSR Example App', () => {
  it('should render successfully without throwing errors', () => {
    const { container } = render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // Let's print the HTML structure to see if it mounted or returned empty/threw
    console.log('CONTAINER HTML:', container.innerHTML);

    expect(container.innerHTML).not.toBe('');
  });

  it('should support deleting a task and time traveling back/forward', async () => {
    render(
      <App />
    );

    // Click on Task Manager in the sidebar, which redirects to Login page
    const taskManagerLink = screen.getByText('Task Manager');
    await act(async () => {
      taskManagerLink.click();
    });

    // We should now be on the login page. Let's authenticate.
    const usernameInput = screen.getByPlaceholderText('e.g. guest');
    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'admin' } });
    });

    const submitButton = screen.getByText('Authenticate & Continue');
    await act(async () => {
      submitButton.click();
    });

    // Now we should be on the Task Manager page. Let's verify we have tasks.
    const deleteButtons = screen.getAllByTitle('Delete Task');
    expect(deleteButtons.length).toBeGreaterThan(0);

    const initialTaskItems = screen.getAllByText(/Scaffold the new template|Configure Tailwind CSS v3/);
    expect(initialTaskItems.length).toBeGreaterThan(0);

    // Click delete on the first task
    await act(async () => {
      deleteButtons[0].click();
    });

    // Verify the task was deleted from the UI list
    await waitFor(() => {
      expect(screen.queryByText('Scaffold the new template')).toBeNull();
    });

    // Click the "Actions Timeline" tab in the devtools
    const actionsTab = screen.getByText('Actions Timeline');
    await act(async () => {
      actionsTab.click();
    });

    // Find the timeline actions in the devtools.
    // The timeline actions have class/text: "deleteTask"
    const deleteTaskActionEl = screen.getAllByText('deleteTask').find(el => el.tagName === 'SPAN');
    expect(deleteTaskActionEl).toBeDefined();

    // The action before it is "@@INIT" or whatever action was there before
    const initActionEl = screen.getByText('@@INIT');
    expect(initActionEl).toBeDefined();

    // Let's click "@@INIT" to time travel back!
    console.log("Clicking @@INIT action...");
    await act(async () => {
      initActionEl.click();
    });

    // Let's verify that the deleted task is back!
    const restoredTaskItems = screen.getAllByText(/Scaffold the new template/);
    expect(restoredTaskItems.length).toBeGreaterThan(0);

    // Click "deleteTask" action to go forward in time again
    console.log("Clicking deleteTask action...");
    await act(async () => {
      deleteTaskActionEl.click();
    });

    // Verify it is gone again
    await waitFor(() => {
      expect(screen.queryByText('Scaffold the new template')).toBeNull();
    });
  });
});
