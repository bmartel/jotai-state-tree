/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { clearAllRegistries, resetGlobalStore } from '../../index';
import { App } from '../../../examples/note-taking-ssr/src/App';

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
});

describe('SSR Note Taking Example App', () => {
  it('should support rendering from an SSR snapshot, editing, creating, filtering, and deleting notes', () => {
    const { container } = render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // --- 1. Verify Initial Hydrated State ---
    expect(screen.getByText('SSR Notes Manager')).toBeDefined();
    expect(screen.getByText('Hydration: Active')).toBeDefined();

    // Check sidebar note list has the hydrated notes
    const sidebar = container.querySelector('.sidebar') as HTMLElement;
    expect(within(sidebar).getByText('🚀 SSR Hydration in jotai-state-tree')).toBeDefined();
    expect(within(sidebar).getByText('💡 Custom Jotai Store Binding')).toBeDefined();

    // Check that the selected note is ssr1 ("🚀 SSR Hydration in jotai-state-tree") in the editor
    const editorPanel = container.querySelector('.editor-panel') as HTMLElement;
    const titleInput = editorPanel.querySelector('.note-title-input') as HTMLInputElement;
    expect(titleInput.value).toBe('🚀 SSR Hydration in jotai-state-tree');

    const textarea = editorPanel.querySelector('.note-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('This note represents pre-rendered server state');

    // --- 2. Select a Different Note ---
    const secondNoteBtn = within(sidebar).getByText('💡 Custom Jotai Store Binding').closest('button')!;
    fireEvent.click(secondNoteBtn);

    // Verify title and content input updated to ssr2
    expect(titleInput.value).toBe('💡 Custom Jotai Store Binding');
    expect(textarea.value).toContain('Under the hood, jotai-state-tree binds to Jotai stores');

    // --- 3. Edit Note Title and Content ---
    fireEvent.change(titleInput, { target: { value: 'Isolating Store States' } });
    fireEvent.change(textarea, { target: { value: 'New content for testing store isolation' } });

    // Verify change is reflected in the sidebar list
    expect(within(sidebar).getByText('Isolating Store States')).toBeDefined();
    expect(within(sidebar).getByText('New content for testing store isolation')).toBeDefined();

    // --- 4. Search / Filter Notes ---
    const searchInput = within(sidebar).getByPlaceholderText('Search notes...') as HTMLInputElement;
    
    // Search for "Hydration" (only should match the first note)
    fireEvent.change(searchInput, { target: { value: 'Hydration' } });
    expect(within(sidebar).getByText('🚀 SSR Hydration in jotai-state-tree')).toBeDefined();
    expect(within(sidebar).queryByText('Isolating Store States')).toBeNull();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(within(sidebar).getByText('🚀 SSR Hydration in jotai-state-tree')).toBeDefined();
    expect(within(sidebar).getByText('Isolating Store States')).toBeDefined();

    // --- 5. Add a New Note ---
    const addBtn = within(sidebar).getByRole('button', { name: '+ Add New Note' });
    fireEvent.click(addBtn);

    // Verify new note is added and selected
    expect(titleInput.value).toBe('Untitled Note');
    expect(textarea.value).toBe('');
    expect(within(sidebar).getByText('Untitled Note')).toBeDefined();

    // Modify the new note
    fireEvent.change(titleInput, { target: { value: 'My Shopping List' } });
    fireEvent.change(textarea, { target: { value: 'Apples, Oranges, Bananas' } });
    expect(within(sidebar).getByText('My Shopping List')).toBeDefined();

    // --- 6. Delete Note ---
    const deleteBtn = within(editorPanel).getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteBtn);

    // Verify deleted note is gone
    expect(within(sidebar).queryByText('My Shopping List')).toBeNull();
    // The note selection falls back to undefined or first element depending on implementation.
    // In our store.ts: "if (self.selectedNoteId === id) { self.selectedNoteId = undefined; }"
    // So selectedNote becomes undefined, displaying "No note selected."
    expect(screen.getByText('No note selected. Select a note or create one to edit.')).toBeDefined();
  });
});
