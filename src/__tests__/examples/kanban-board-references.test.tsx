/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearAllRegistries, resetGlobalStore } from '../../index';
import { App } from '../../../examples/kanban-board-references/src/App';

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
});

describe('Collaborative Kanban Board Example App', () => {
  it('should support column rendering, member management, task operations, safe reference updates, and snapshot export/apply', async () => {
    const user = userEvent.setup();
    
    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // 1. Verify Columns & Initial Tasks
    expect(screen.getByText('Define project requirements')).toBeDefined(); // Backlog
    expect(screen.getByText('Design database schema')).toBeDefined(); // Todo
    expect(screen.getByText('Implement jotai-state-tree integration')).toBeDefined(); // In Progress
    expect(screen.getByText('Set up build pipeline')).toBeDefined(); // Done

    // Verify assignees are resolved correctly
    expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob Jones').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Charlie Brown').length).toBeGreaterThan(0);

    // 2. Add Team Member
    const memberInput = screen.getByPlaceholderText('New member name...');
    const addMemberBtn = screen.getByRole('button', { name: 'Add Member' });

    await user.type(memberInput, 'David Miller');
    await user.click(addMemberBtn);

    await waitFor(() => {
      // Should find at least the option and the tag
      expect(screen.getAllByText('David Miller').length).toBeGreaterThan(0);
    });

    // 3. Add Task Card
    const formPanel = screen.getByText('Add New Task Card').closest('.panel')!;
    const taskInput = within(formPanel).getByPlaceholderText('Task description...');
    const formSelects = within(formPanel).getAllByRole('combobox');
    const formStatusSelect = formSelects[0];
    const formAssigneeSelect = formSelects[1];
    const createTaskBtn = within(formPanel).getByRole('button', { name: 'Create Task' });

    await user.type(taskInput, 'Write documentation');
    await user.selectOptions(formStatusSelect, 'in_progress');
    const davidOption = within(formAssigneeSelect).getByRole('option', { name: 'David Miller' }) as HTMLOptionElement;
    await user.selectOptions(formAssigneeSelect, davidOption.value);
    await user.click(createTaskBtn);

    await waitFor(() => {
      expect(screen.getByText('Write documentation')).toBeDefined();
    });

    // 4. Change Status via Dropdown (Drag & Drop replacement)
    const taskCard = screen.getByText('Write documentation').closest('.kanban-card')!;
    const newCardStatusSelect = within(taskCard).getByRole('combobox');
    await user.selectOptions(newCardStatusSelect, 'done');

    // 5. Safe Reference Demonstration (Delete User)
    // Find the member tag element specifically (filter out the dropdown option)
    const memberTags = screen.getAllByText('David Miller');
    const memberTag = memberTags.find(el => el.classList?.contains('member-tag'))!;
    const deleteDavidBtn = within(memberTag).getByRole('button', { name: 'Remove Member' });
    await user.click(deleteDavidBtn);

    // Verify David Miller tag is removed
    await waitFor(() => {
      const remainingTags = screen.queryAllByText('David Miller').filter(el => el.classList?.contains('member-tag'));
      expect(remainingTags.length).toBe(0);
    });

    // Verify that the task "Write documentation" assignee automatically resolved to "Unassigned"
    await waitFor(() => {
      const updatedCard = screen.getByText('Write documentation').closest('.kanban-card')!;
      expect(within(updatedCard).getByText('Unassigned')).toBeDefined();
    });

    // 6. Delete Task Card
    const currentTaskCard = screen.getByText('Write documentation').closest('.kanban-card')!;
    const taskDeleteBtn = within(currentTaskCard).getByRole('button', { name: 'Delete Card' });
    await user.click(taskDeleteBtn);

    await waitFor(() => {
      expect(screen.queryByText('Write documentation')).toBeNull();
    });

    // 7. Snapshot Export and Apply
    const exportBtn = screen.getByRole('button', { name: 'Export Snapshot' });
    const applyBtn = screen.getByRole('button', { name: 'Apply Snapshot' });
    const textarea = screen.getByPlaceholderText(/Click 'Export Snapshot' to fill/) as HTMLTextAreaElement;

    // Click Export Snapshot
    await user.click(exportBtn);
    expect(textarea.value).toContain('Define project requirements');

    // Modify snapshot JSON in textarea to clear all tasks
    const currentSnapshot = JSON.parse(textarea.value);
    currentSnapshot.tasks = {}; // Empty tasks
    
    fireEvent.change(textarea, { target: { value: JSON.stringify(currentSnapshot) } });
    await user.click(applyBtn);

    // Verify all task cards are cleared
    await waitFor(() => {
      expect(screen.queryByText('Define project requirements')).toBeNull();
      expect(screen.queryByText('Design database schema')).toBeNull();
      expect(screen.queryByText('Implement jotai-state-tree integration')).toBeNull();
      expect(screen.queryByText('Set up build pipeline')).toBeNull();
    });
  });
});
