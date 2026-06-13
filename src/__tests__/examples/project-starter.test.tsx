/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { clearAllRegistries, resetGlobalStore } from '../../index';
import { App } from '../../../examples/project-starter/src/App';

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
});

describe('Project Starter Example App', () => {
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
    expect(screen.queryByText('Scaffold the new template')).toBeNull();

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
    expect(screen.queryByText('Scaffold the new template')).toBeNull();
  });
});
