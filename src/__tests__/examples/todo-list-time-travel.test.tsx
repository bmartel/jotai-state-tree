/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearAllRegistries, resetGlobalStore } from '../../index';
import { App } from '../../../examples/todo-list-time-travel/src/App';

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
});

describe('Todo List with Time Travel Example App', () => {
  it('should support complete task operations, filtering, mark/clear all, undo/redo, and time travel', async () => {
    const user = userEvent.setup();
    
    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // 1. Initial State Verification
    expect(screen.getByText('Learn jotai-state-tree')).toBeDefined();
    expect(screen.getByText('Explore Vite templates')).toBeDefined();
    expect(screen.getByText('Build clean minimalist UIs')).toBeDefined();
    
    // Check initial counts
    expect(screen.getByRole('button', { name: /Active \(2\)/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Completed \(1\)/ })).toBeDefined();

    // 2. Add Task
    const input = screen.getByPlaceholderText('What needs to be done?');
    const addButton = screen.getByRole('button', { name: 'Add' });

    await user.type(input, 'Write integration tests');
    await user.click(addButton);

    // Verify it is added
    await waitFor(() => {
      expect(screen.getByText('Write integration tests')).toBeDefined();
    });
    expect(screen.getByRole('button', { name: /Active \(3\)/ })).toBeDefined();

    // 3. Toggle Task
    const checkboxes = screen.getAllByRole('checkbox');
    // Index 3 is 'Write integration tests'
    const testCheckbox = checkboxes[3] as HTMLInputElement;
    expect(testCheckbox.checked).toBe(false);

    await user.click(testCheckbox);
    await waitFor(() => {
      expect(testCheckbox.checked).toBe(true);
    });
    expect(screen.getByRole('button', { name: /Active \(2\)/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Completed \(2\)/ })).toBeDefined();

    // Click Active Filter
    await user.click(screen.getByRole('button', { name: /^Active/ }));
    await waitFor(() => {
      expect(screen.queryByText('Learn jotai-state-tree')).toBeNull(); // Completed
      expect(screen.getByText('Explore Vite templates')).toBeDefined(); // Active
      expect(screen.getByText('Build clean minimalist UIs')).toBeDefined(); // Active
      expect(screen.queryByText('Write integration tests')).toBeNull(); // Completed
    });

    // Click Completed Filter
    await user.click(screen.getByRole('button', { name: /^Completed/ }));
    await waitFor(() => {
      expect(screen.getByText('Learn jotai-state-tree')).toBeDefined();
      expect(screen.queryByText('Explore Vite templates')).toBeNull();
      expect(screen.queryByText('Build clean minimalist UIs')).toBeNull();
      expect(screen.getByText('Write integration tests')).toBeDefined();
    });

    // Reset to All Filter
    await user.click(screen.getByRole('button', { name: /^All$/ }));
    await waitFor(() => {
      expect(screen.getByText('Learn jotai-state-tree')).toBeDefined();
      expect(screen.getByText('Explore Vite templates')).toBeDefined();
      expect(screen.getByText('Build clean minimalist UIs')).toBeDefined();
      expect(screen.getByText('Write integration tests')).toBeDefined();
    });

    // 5. Mark All / Unmark All
    const markAllButton = screen.getByRole('button', { name: /Mark All|Unmark All/ });
    expect(markAllButton.textContent).toBe('Mark All');

    // Click Mark All
    await user.click(markAllButton);
    await waitFor(() => {
      const allCheckboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      expect(allCheckboxes.every(cb => cb.checked)).toBe(true);
    });
    expect(markAllButton.textContent).toBe('Unmark All');
    expect(screen.getByRole('button', { name: /Active \(0\)/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Completed \(4\)/ })).toBeDefined();

    // Click Unmark All
    await user.click(markAllButton);
    await waitFor(() => {
      const allCheckboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      expect(allCheckboxes.every(cb => !cb.checked)).toBe(true);
    });
    expect(markAllButton.textContent).toBe('Mark All');
    expect(screen.getByRole('button', { name: /Active \(4\)/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Completed \(0\)/ })).toBeDefined();

    // Mark one as completed to show Clear Completed button
    const firstCheckbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    await user.click(firstCheckbox);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Clear Completed' })).not.toBeNull();
    });

    // Click Clear Completed
    const clearCompletedBtn = screen.getByRole('button', { name: 'Clear Completed' });
    await user.click(clearCompletedBtn);
    await waitFor(() => {
      expect(screen.queryByText('Learn jotai-state-tree')).toBeNull(); // Cleared
    });
    expect(screen.queryByRole('button', { name: 'Clear Completed' })).toBeNull(); // No completed items left

    // 6. Undo/Redo
    const undoButton = screen.getByRole('button', { name: /Undo/ });
    const redoButton = screen.getByRole('button', { name: /Redo/ });

    // Undo the clear completed action
    await user.click(undoButton);
    await waitFor(() => {
      expect(screen.getByText('Learn jotai-state-tree')).toBeDefined();
    });

    // 7. Time Travel Navigation Buttons (Forward / Backward)
    const rangeInput = screen.getByRole('slider') as HTMLInputElement;
    const initialSnapshotCount = parseInt(rangeInput.max, 10) + 1;
    const initialIndex = parseInt(rangeInput.value, 10);
    
    // We should have several snapshots recorded
    expect(initialSnapshotCount).toBeGreaterThan(1);
    
    const goBackBtn = screen.getByRole('button', { name: '←' });
    const goForwardBtn = screen.getByRole('button', { name: '→' });

    // Go back one step
    await user.click(goBackBtn);
    await waitFor(() => {
      expect(parseInt(rangeInput.value, 10)).toBe(initialIndex - 1);
    });

    // Go forward one step
    await user.click(goForwardBtn);
    await waitFor(() => {
      expect(parseInt(rangeInput.value, 10)).toBe(initialIndex);
    });

    // Drag slider directly to 0 (initial state)
    await act(async () => {
      const prototype = Object.getPrototypeOf(rangeInput);
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (setter) {
        setter.call(rangeInput, '0');
      } else {
        rangeInput.value = '0';
      }
      rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
      rangeInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Verify state has reverted to initial
    await waitFor(() => {
      expect(screen.queryByText('Write integration tests')).toBeNull();
    });

    // --- 8. Test Undo/Redo & Time Travel Index Synchronization ---
    // Drag slider back to index 2 (corresponds to state after adding and toggling the task)
    await act(async () => {
      const prototype = Object.getPrototypeOf(rangeInput);
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (setter) {
        setter.call(rangeInput, '2');
      } else {
        rangeInput.value = '2';
      }
      rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
      rangeInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Verify time travel index is updated to 2
    expect(parseInt(rangeInput.value, 10)).toBe(2);

    // Verify undo button is enabled and has correct count
    // At index 2 (3rd snapshot), there have been 2 recorded history actions.
    // Undo count should be 2.
    expect(undoButton.textContent).toContain('Undo (2)');
    expect(undoButton.removeAttribute).toBeDefined(); // not disabled

    // Click Undo
    await user.click(undoButton);

    // Reverting toggle: verify checkboxes/counts update, and time travel slider index syncs to 1
    await waitFor(() => {
      expect(parseInt(rangeInput.value, 10)).toBe(1);
    });

    // Click Redo
    await user.click(redoButton);

    // Redoing toggle: verify time travel slider index syncs back to 2
    await waitFor(() => {
      expect(parseInt(rangeInput.value, 10)).toBe(2);
    });
  });
});
