/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearAllRegistries, resetGlobalStore } from '../../index';
import { App } from '../../../examples/multipage-router/src/App';
beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();

  if (typeof window !== 'undefined') {
    vi.stubGlobal('location', {
      pathname: '/',
      search: '',
      hash: '',
      href: 'http://localhost/',
    });
  }
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
});

describe('Multipage Bookstore Router Example App', () => {
  it('should support home layout, catalog query filters, parameter matching, wildcards, auth redirection, login, and admin views', async () => {
    const user = userEvent.setup();

    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // ========================================================================
    // 1. Initial Home Screen Check
    // ========================================================================
    expect(screen.getByText('Welcome to State Bookshop')).toBeDefined();
    
    // State Inspector Check
    expect(screen.getByText('"/"')).toBeDefined();
    expect(screen.getByText('INITIAL')).toBeDefined();
    expect(screen.getByText('"home"')).toBeDefined();

    // ========================================================================
    // 2. Navigation to Catalog and Query Filtering
    // ========================================================================
    const catalogNavLink = screen.getByRole('link', { name: /Catalog/ });
    await user.click(catalogNavLink);

    await waitFor(() => {
      expect(screen.getByText('Book Catalog')).toBeDefined();
    });
    expect(screen.getByText('"/books"')).toBeDefined();
    expect(screen.getByText('PUSH')).toBeDefined();
    
    // Check list of books (should display all initial books)
    expect(screen.getByText('Designing Data-Intensive Applications')).toBeDefined();
    expect(screen.getByText('Dune')).toBeDefined();
    expect(screen.getByText('The Hobbit')).toBeDefined();

    // Filter by Tech category
    const techCategoryButton = screen.getByRole('button', { name: 'Tech' });
    await user.click(techCategoryButton);

    await waitFor(() => {
      // Should show Tech books
      expect(screen.getByText('Designing Data-Intensive Applications')).toBeDefined();
      expect(screen.getByText('The Pragmatic Programmer')).toBeDefined();
      // Should filter out Sci-Fi and Fantasy
      expect(screen.queryByText('Dune')).toBeNull();
      expect(screen.queryByText('The Hobbit')).toBeNull();
    });
    expect(screen.getByText(/"category": "Tech"/)).toBeDefined();

    // Search query within Tech category
    const searchInput = screen.getByPlaceholderText('Search by title or author...');
    const searchButton = screen.getByRole('button', { name: 'Search' });

    await user.type(searchInput, 'Pragmatic');
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.queryByText('Designing Data-Intensive Applications')).toBeNull();
      expect(screen.getByText('The Pragmatic Programmer')).toBeDefined();
    });
    expect(screen.getByText(/"search": "Pragmatic"/)).toBeDefined();

    // ========================================================================
    // 3. Dynamic Route Parameter Matching (Book Details)
    // ========================================================================
    const bookCard = screen.getByText('The Pragmatic Programmer');
    await user.click(bookCard);

    await waitFor(() => {
      expect(screen.getByText('Andy Hunt & Dave Thomas')).toBeDefined();
      expect(screen.getByText('2')).toBeDefined();
    });
    expect(screen.getByText('"/books/2"')).toBeDefined();
    expect(screen.getByText('"book-details"')).toBeDefined();
    expect(screen.getByText(/"id": "2"/)).toBeDefined();

    // Click Go Back
    const backBtn = screen.getByRole('button', { name: /Go Back/ });
    
    // Mock window.history.back to simulate popping location back to catalog
    window.history.back = vi.fn().mockImplementation(() => {
      act(() => {
        vi.stubGlobal('location', {
          pathname: '/books',
          search: '?category=Tech&search=Pragmatic',
          hash: '',
          href: 'http://localhost/books?category=Tech&search=Pragmatic',
        });
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
    });

    await user.click(backBtn);
    await waitFor(() => {
      expect(screen.getByText('Book Catalog')).toBeDefined();
      expect(screen.getByText('The Pragmatic Programmer')).toBeDefined();
    });
    expect(screen.getByText('"/books"')).toBeDefined();

    // Restore stubbed globals so subsequent navigations work
    vi.unstubAllGlobals();

    // ========================================================================
    // 4. Wildcard Route Matching
    // ========================================================================
    const filesNavLink = screen.getByRole('link', { name: /Files/ });
    await user.click(filesNavLink);

    await waitFor(() => {
      expect(screen.getByText('Wildcard File Browser')).toBeDefined();
    });
    expect(screen.getByText('"/files"')).toBeDefined();
    expect(screen.getByText('"files"')).toBeDefined();

    // Click on a file test link
    const duneFileBtn = screen.getByRole('button', { name: 'dune.jpg' });
    await user.click(duneFileBtn);

    await waitFor(() => {
      expect(screen.getByText('/images/covers/dune.jpg')).toBeDefined();
    });
    expect(screen.getByText('"/files/images/covers/dune.jpg"')).toBeDefined();
    expect(screen.getByText(/"\*": "\/images\/covers\/dune.jpg"/)).toBeDefined();

    // ========================================================================
    // 5. Auth Navigation Guards & Interception Redirects
    // ========================================================================
    const adminNavLink = screen.getByRole('link', { name: /Admin Panel/ });
    await user.click(adminNavLink);

    // Intercepted and Redirected to login
    await waitFor(() => {
      expect(screen.getByText('Administrative Login')).toBeDefined();
      expect(screen.getByText(/You were redirected because access to/)).toBeDefined();
    });
    expect(screen.getByText('"/login"')).toBeDefined();
    expect(screen.getByText(/"redirect": "\/admin"/)).toBeDefined();

    // ========================================================================
    // 6. Login and Return Redirection
    // ========================================================================
    const usernameInput = screen.getByPlaceholderText('Enter your name (e.g. guest)');
    const submitLoginBtn = screen.getByRole('button', { name: 'Login & Continue' });

    await user.type(usernameInput, 'guest');
    await user.click(submitLoginBtn);

    // Redirected back to the original target: /admin
    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeDefined();
      expect(screen.getAllByText('guest').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('"/admin"')).toBeDefined();
    expect(screen.getByText('"admin"')).toBeDefined();

    // ========================================================================
    // 7. Logout Flow
    // ========================================================================
    const logoutBtn = screen.getByRole('button', { name: 'Logout' });
    await user.click(logoutBtn);

    await waitFor(() => {
      expect(screen.getByText('Welcome to State Bookshop')).toBeDefined();
      expect(screen.queryAllByText('guest').length).toBe(0);
    });
    expect(screen.getByText('"/"')).toBeDefined();
  });
});
