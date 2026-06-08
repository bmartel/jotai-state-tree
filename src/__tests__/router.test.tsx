/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createRouter } from '../router';
import { RouterContext, RouteView } from '../react';
import { clearAllRegistries, resetGlobalStore } from '../index';

describe('State Router', () => {
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
      window.history.pushState = vi.fn();
      window.history.replaceState = vi.fn();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const routes = [
    { path: '/', name: 'home' },
    { path: '/about', name: 'about', meta: { requiresAuth: false } },
    { path: '/users/:id', name: 'user-profile' },
    { path: '/files/*', name: 'files' },
  ];

  it('should initialize with correct default state', () => {
    const router = createRouter({
      routes,
      initialUrl: 'http://localhost/about?search=hello#sec1',
    });

    expect(router.pathname).toBe('/about');
    expect(router.search).toBe('?search=hello');
    expect(router.hash).toBe('#sec1');
    expect(router.action).toBe('INITIAL');
    expect(router.query).toEqual({ search: 'hello' });
    expect(router.currentRouteName).toBe('about');
    expect(router.currentRoute).toBeDefined();
    expect(router.currentRoute?.name).toBe('about');
    expect(router.currentRoute?.meta.requiresAuth).toBe(false);
  });

  it('should match path parameter routes correctly', () => {
    const router = createRouter({
      routes,
      initialUrl: '/users/456',
    });

    expect(router.currentRouteName).toBe('user-profile');
    expect(router.params).toEqual({ id: '456' });
  });

  it('should match wildcards correctly', () => {
    const router = createRouter({
      routes,
      initialUrl: '/files/images/cat.png',
    });

    expect(router.currentRouteName).toBe('files');
    expect(router.params).toEqual({ '*': '/images/cat.png' });
  });

  it('should change path on push and sync to window history', async () => {
    const router = createRouter({
      routes,
      initialUrl: '/',
    });

    await act(async () => {
      await router.push('/users/123?ref=test#bottom');
    });

    expect(router.pathname).toBe('/users/123');
    expect(router.search).toBe('?ref=test');
    expect(router.hash).toBe('#bottom');
    expect(router.action).toBe('PUSH');
    expect(router.params).toEqual({ id: '123' });
    expect(router.query).toEqual({ ref: 'test' });
    expect(router.currentRouteName).toBe('user-profile');

    expect(window.history.pushState).toHaveBeenCalledWith(
      undefined,
      '',
      '/users/123?ref=test#bottom'
    );
  });

  it('should change path on replace', async () => {
    const router = createRouter({
      routes,
      initialUrl: '/',
    });

    await act(async () => {
      await router.replace('/about');
    });

    expect(router.pathname).toBe('/about');
    expect(router.action).toBe('REPLACE');
    expect(window.history.replaceState).toHaveBeenCalledWith(
      undefined,
      '',
      '/about'
    );
  });

  it('should support synchronous beforeNavigate guard blocking transition', async () => {
    const beforeNavigate = vi.fn().mockReturnValue(false);
    const router = createRouter({
      routes,
      initialUrl: '/',
      beforeNavigate,
    });

    await act(async () => {
      await router.push('/about');
    });

    expect(router.pathname).toBe('/');
    expect(beforeNavigate).toHaveBeenCalled();
  });

  it('should support synchronous beforeNavigate guard redirecting transition', async () => {
    const beforeNavigate = vi.fn().mockImplementation((from, to) => {
      if (to.pathname === '/about') {
        return '/users/guest';
      }
      return true;
    });

    const router = createRouter({
      routes,
      initialUrl: '/',
      beforeNavigate,
    });

    await act(async () => {
      await router.push('/about');
    });

    expect(router.pathname).toBe('/users/guest');
    expect(router.currentRouteName).toBe('user-profile');
  });

  it('should support asynchronous beforeNavigate guard', async () => {
    const beforeNavigate = vi.fn().mockImplementation(async (from, to) => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(to.pathname !== '/about'), 10);
      });
    });

    const router = createRouter({
      routes,
      initialUrl: '/',
      beforeNavigate,
    });

    await act(async () => {
      await router.push('/about');
    });
    expect(router.pathname).toBe('/');

    await act(async () => {
      await router.push('/users/111');
    });
    expect(router.pathname).toBe('/users/111');
  });

  it('should call afterNavigate hook after successful navigation', async () => {
    const afterNavigate = vi.fn();
    const router = createRouter({
      routes,
      initialUrl: '/',
      afterNavigate,
    });

    await act(async () => {
      await router.push('/about');
    });

    expect(afterNavigate).toHaveBeenCalled();
    expect(afterNavigate.mock.calls[0][0].pathname).toBe('/about');
  });

  it('should handle popstate listener and run guards, reverting URL if blocked', async () => {
    let popStateCallback: any = null;
    vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
      if (event === 'popstate') {
        popStateCallback = callback;
      }
    });

    const beforeNavigate = vi.fn().mockReturnValue(false);
    const router = createRouter({
      routes,
      initialUrl: '/about',
      beforeNavigate,
    });

    expect(popStateCallback).toBeTypeOf('function');

    vi.stubGlobal('location', {
      pathname: '/users/999',
      search: '',
      hash: '',
    });

    await act(async () => {
      popStateCallback(new PopStateEvent('popstate', { state: null }));
    });

    expect(router.pathname).toBe('/about');
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/about');
  });

  it('should render correct component via RouteView and inject route params as props', () => {
    const HomePage = () => <div data-testid="home">Home Page</div>;
    const UserProfilePage = (props: { id: string }) => (
      <div data-testid="user">User: {props.id}</div>
    );
    const FallbackPage = () => <div data-testid="fallback">Fallback</div>;

    const router = createRouter({
      routes,
      initialUrl: '/users/777',
    });

    const pages = {
      home: HomePage,
      'user-profile': UserProfilePage,
    };

    render(
      <RouterContext.Provider value={router}>
        <RouteView pages={pages} fallback={<FallbackPage />} />
      </RouterContext.Provider>
    );

    expect(screen.getByTestId('user').textContent).toBe('User: 777');
  });

  it('should reactively re-render when route changes', async () => {
    const HomePage = () => <div data-testid="home">Home</div>;
    const AboutPage = () => <div data-testid="about">About</div>;

    const router = createRouter({
      routes,
      initialUrl: '/',
    });

    const pages = {
      home: HomePage,
      about: AboutPage,
    };

    render(
      <RouterContext.Provider value={router}>
        <RouteView pages={pages} />
      </RouterContext.Provider>
    );

    expect(screen.getByTestId('home')).toBeDefined();
    expect(screen.queryByTestId('about')).toBeNull();

    await act(async () => {
      await router.push('/about');
    });

    expect(screen.queryByTestId('home')).toBeNull();
    expect(screen.getByTestId('about')).toBeDefined();
  });
});
