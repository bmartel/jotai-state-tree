/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
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
});
