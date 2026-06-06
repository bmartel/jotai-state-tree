/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { clearAllRegistries, resetGlobalStore } from '../../index';
import { App } from '../../../examples/form-builder-dynamic/src/App';

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
});

describe('Dynamic Form Builder Example App', () => {
  it('should support editing the form, modifying sections/subsections recursively, adding different question types, and validating rules dynamically', () => {
    const { container } = render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // --- 1. Initial State Verification ---
    expect(screen.getByText('Dynamic Form Builder')).toBeDefined();
    
    // Check initial title input
    const titleInput = screen.getByDisplayValue('Customer Feedback Survey');
    expect(titleInput).toBeDefined();

    // Verify initial questions are rendered in preview
    const previewPanel = screen.getByText('Live Form Preview').closest('.panel')!;
    expect(within(previewPanel).getByText('Customer Feedback Survey')).toBeDefined();
    expect(within(previewPanel).getByText('What is your name?')).toBeDefined();
    expect(within(previewPanel).getByText('Overall Rating (1-10)')).toBeDefined();
    expect(within(previewPanel).getByText('How did you hear about us?')).toBeDefined();
    expect(within(previewPanel).getByText('Technical Support Quality')).toBeDefined();
    expect(within(previewPanel).getByText('Did the agent resolve your issue?')).toBeDefined();

    // Validation engine state (should be valid initially)
    const valPanel = screen.getByText('Validation Engine').closest('.panel')!;
    expect(within(valPanel).getByText(/Form schema structure is fully valid/)).toBeDefined();

    // --- 2. Edit Form Title ---
    fireEvent.change(titleInput, { target: { value: 'My Awesome Custom Survey' } });
    expect(within(previewPanel).getByText('My Awesome Custom Survey')).toBeDefined();

    // --- 3. Add Questions of Different Types ---
    const structPanel = screen.getByText('Structure Editor').closest('.panel')!;
    const rootEditorContainer = structPanel.querySelector('div[style*="margin-left: 0"]') as HTMLElement;
    const rootControls = rootEditorContainer.lastElementChild as HTMLElement;
    
    // Test Text Question addition
    const addTextBtn = within(rootControls).getByRole('button', { name: '+ Text' });
    fireEvent.click(addTextBtn);

    // The new question default label is "New TEXT Question"
    const textLabelInput = within(structPanel).getByDisplayValue('New TEXT Question');
    fireEvent.change(textLabelInput, { target: { value: 'What is your favorite color?' } });
    expect(within(previewPanel).getByText('What is your favorite color?')).toBeDefined();

    // Check placeholder input for text question within its edit card
    const questionCardsBefore = structPanel.querySelectorAll('.question-edit-card');
    const newTextCard = Array.from(questionCardsBefore).find(card => 
      card.querySelector('.question-number')?.textContent === 'text Field' && 
      (card.querySelector('input[type="text"]') as HTMLInputElement)?.value === 'What is your favorite color?'
    ) as HTMLElement;
    expect(newTextCard).toBeDefined();

    const placeholderInput = within(newTextCard).getByPlaceholderText('Helper prompt...');
    fireEvent.change(placeholderInput, { target: { value: 'e.g. Blue, Red...' } });
    const previewTextInput = within(previewPanel).getByPlaceholderText('e.g. Blue, Red...');
    expect(previewTextInput).toBeDefined();

    // Test Number Question addition
    const addNumBtn = within(rootControls).getByRole('button', { name: '+ Number' });
    fireEvent.click(addNumBtn);

    const numLabelInput = within(structPanel).getByDisplayValue('New NUMBER Question');
    fireEvent.change(numLabelInput, { target: { value: 'How many pets do you have?' } });
    expect(within(previewPanel).getByText('How many pets do you have?')).toBeDefined();

    // Test Choice Question addition
    const addChoiceBtn = within(rootControls).getByRole('button', { name: '+ Choice' });
    fireEvent.click(addChoiceBtn);

    const choiceLabelInput = within(structPanel).getByDisplayValue('New CHOICE Question');
    fireEvent.change(choiceLabelInput, { target: { value: 'Choose a flavor' } });
    expect(within(previewPanel).getByText('Choose a flavor')).toBeDefined();

    // Add Options to Choice Question
    // Let's find the "Add option..." text input specifically for the new choice question
    const questionCards = structPanel.querySelectorAll('.question-edit-card');
    const newChoiceCard = Array.from(questionCards).find(card => 
      card.querySelector('.question-number')?.textContent === 'choice Field' && 
      (card.querySelector('input[type="text"]') as HTMLInputElement)?.value === 'Choose a flavor'
    ) as HTMLElement;

    expect(newChoiceCard).toBeDefined();
    const addOptInput = within(newChoiceCard).getByPlaceholderText('Add option...');
    const addOptBtn = within(newChoiceCard).getByRole('button', { name: 'Add' });

    fireEvent.change(addOptInput, { target: { value: 'Chocolate' } });
    fireEvent.click(addOptBtn);

    // Verify option is added to the options list
    expect(within(newChoiceCard).getByDisplayValue('Chocolate')).toBeDefined();
    
    // Verify preview dropdown contains the option
    const flavorSelect = within(previewPanel).getByText('Choose a flavor').closest('.form-group')?.querySelector('select')!;
    expect(flavorSelect).toBeDefined();
    expect(within(flavorSelect).getByText('Chocolate')).toBeDefined();

    // --- 4. Subsections Recursive Manipulation ---
    const addSecBtn = within(rootControls).getByRole('button', { name: '+ Section' });
    fireEvent.click(addSecBtn);

    // Verify section input is added
    const newSecInput = within(structPanel).getByDisplayValue('New Sub-section');
    fireEvent.change(newSecInput, { target: { value: 'Demographics Info' } });
    expect(within(previewPanel).getByText('Demographics Info')).toBeDefined();

    // Add question inside the new subsection
    const demoSecContainer = newSecInput.closest('div')!.parentElement!.parentElement!;
    const demoTextBtn = within(demoSecContainer).getByRole('button', { name: '+ Text' });
    fireEvent.click(demoTextBtn);

    const demoQuestionInput = within(demoSecContainer).getByDisplayValue('New TEXT Question');
    fireEvent.change(demoQuestionInput, { target: { value: 'Which country are you from?' } });
    expect(within(previewPanel).getByText('Which country are you from?')).toBeDefined();

    // --- 5. Verify Validation Rules ---
    // Section title cleared out
    fireEvent.change(newSecInput, { target: { value: '' } });
    // Check validation box has the section error
    expect(within(valPanel).getByText(/Section ".*" is missing a title/)).toBeDefined();

    // Put it back
    fireEvent.change(newSecInput, { target: { value: 'Demographics Info' } });
    expect(within(valPanel).queryByText(/Section ".*" is missing a title/)).toBeNull();

    // Choice question validation (Choice question needs at least 2 options. Let's remove options to trigger error)
    // The "Choose a flavor" currently has options: "Option A", "Option B" (defaults) and "Chocolate" we added.
    // Let's remove them.
    const removeOptionBtns = newChoiceCard.querySelectorAll('.icon-btn');
    // The first inputs are options, let's click 'x' on options until we have < 2 options
    // Let's find all the 'x' buttons for options
    const xButtons = Array.from(newChoiceCard.querySelectorAll('button')).filter(btn => btn.textContent === 'x');
    // Remove "Option A"
    fireEvent.click(xButtons[0]);
    // Remove "Option B"
    fireEvent.click(xButtons[1]);
    
    // Now we only have "Chocolate" (1 option), so validation should fail
    expect(within(valPanel).getByText(/Choice Question "Choose a flavor" must have at least 2 options/)).toBeDefined();

    // Add back another option to satisfy validation
    fireEvent.change(addOptInput, { target: { value: 'Vanilla' } });
    fireEvent.click(addOptBtn);

    // Error should be gone
    expect(within(valPanel).queryByText(/Choice Question "Choose a flavor" must have at least 2 options/)).toBeNull();

    // --- 6. Export Schema Snapshot ---
    const jsonBox = container.querySelector('.json-box')!;
    expect(jsonBox).toBeDefined();
    const snapshotText = jsonBox.textContent!;
    expect(snapshotText).toContain('My Awesome Custom Survey');
    expect(snapshotText).toContain('Demographics Info');
    expect(snapshotText).toContain('Choose a flavor');

    // --- 7. Remove Questions and Subsections ---
    // Remove the Demographics subsection using its "Remove" button next to title input
    const removeSecBtn = within(demoSecContainer).getByRole('button', { name: 'Remove' });
    fireEvent.click(removeSecBtn);

    // Section should be gone from preview and editor
    expect(screen.queryByDisplayValue('Demographics Info')).toBeNull();
    expect(within(previewPanel).queryByText('Demographics Info')).toBeNull();
    expect(within(previewPanel).queryByText('Which country are you from?')).toBeNull();
  });
});
