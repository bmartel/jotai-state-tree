import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { expect, test, describe, vi } from 'vitest';
import { RouterProvider } from 'jotai-state-tree/react';
import { createAppStore } from '../models/RootStore';
import { configureRouter } from '../routes/router';
import { Header } from '../components/Header';
import { StoreProvider } from '../App';

describe('Header Component (SPA Integration)', () => {
  test('renders page title from router and handles theme toggles', () => {
    const store = createAppStore();
    const router = configureRouter(store, '/');
    const toggleDevPanelMock = vi.fn();

    render(
      <StoreProvider store={store}>
        <RouterProvider createRouter={() => router}>
          <Header devPanelOpen={false} toggleDevPanel={toggleDevPanelMock} />
        </RouterProvider>
      </StoreProvider>
    );

    // Assert that the page title is extracted from the path matching
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    // Verify DevTools toggle button
    const toggleDevBtn = screen.getByRole('button', { name: /Open DevTools/i });
    expect(toggleDevBtn).toBeInTheDocument();
    fireEvent.click(toggleDevBtn);
    expect(toggleDevPanelMock).toHaveBeenCalledTimes(1);

    // Verify Theme toggling works (it reads/writes to store)
    const themeBtn = screen.getByLabelText('Toggle Theme');
    expect(store.theme).toBe('light');
    
    // Toggle to dark mode
    fireEvent.click(themeBtn);
    expect(store.theme).toBe('dark');

    // Toggle back to light mode
    fireEvent.click(themeBtn);
    expect(store.theme).toBe('light');
  });

  test('renders correct title for settings route', () => {
    const store = createAppStore();
    const router = configureRouter(store, '/settings');

    render(
      <StoreProvider store={store}>
        <RouterProvider createRouter={() => router}>
          <Header devPanelOpen={true} toggleDevPanel={() => {}} />
        </RouterProvider>
      </StoreProvider>
    );

    expect(screen.getByText('System Settings')).toBeInTheDocument();
  });
});
