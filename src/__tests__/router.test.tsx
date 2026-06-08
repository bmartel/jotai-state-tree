/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createRouter, normalizePathname, matchRoutes } from '../router';
import { RouterContext, RouteView, useRouter } from '../react';
import { clearAllRegistries, resetGlobalStore, destroy } from '../index';

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

  it('should initialize using window.location if initialUrl is omitted', () => {
    vi.stubGlobal('location', {
      pathname: '/about',
      search: '?id=1',
      hash: '#hash',
      href: 'http://localhost/about?id=1#hash',
    });

    const router = createRouter({
      routes,
    });

    expect(router.pathname).toBe('/about');
    expect(router.search).toBe('?id=1');
    expect(router.hash).toBe('#hash');
  });

  it('should throw if useRouter is called outside Provider', () => {
    const TestComp = () => {
      useRouter();
      return null;
    };
    expect(() => render(<TestComp />)).toThrow('[jotai-state-tree] useRouter must be used within a RouterContext.Provider');
  });

  it('normalizePathname utility edge cases', () => {
    expect(normalizePathname('about/')).toBe('/about');
    expect(normalizePathname('about')).toBe('/about');
    expect(normalizePathname('/')).toBe('/');
  });

  it('matchPath and matchRoutes edge cases', () => {
    // 1. matchRoutes returns null if no route matches
    const unmatched = matchRoutes(routes, '/invalid-pathname-here');
    expect(unmatched).toBeNull();
  });

  it('currentRoute view and isActive view', () => {
    const router = createRouter({
      routes,
      initialUrl: '/invalid',
    });

    // 1. currentRoute is null when currentRouteName is null
    expect(router.currentRoute).toBeNull();

    // 2. isActive check
    const router2 = createRouter({
      routes,
      initialUrl: '/users/123',
    });
    expect(router2.isActive('user-profile')).toBe(true);
    expect(router2.isActive('user-profile', { id: '123' })).toBe(true);
    expect(router2.isActive('user-profile', { id: '456' })).toBe(false);
    expect(router2.isActive('home')).toBe(false);
  });

  it('redirect and block guards in replace flow', async () => {
    const beforeNavigate = vi.fn().mockImplementation((from, to) => {
      if (to.pathname === '/about') {
        return '/users/blocked';
      }
      if (to.pathname === '/files/secret') {
        return false;
      }
      return true;
    });

    const router = createRouter({
      routes,
      initialUrl: '/',
      beforeNavigate,
    });

    // Replace - block guard
    await act(async () => {
      await router.replace('/files/secret');
    });
    expect(router.pathname).toBe('/');

    // Replace - redirect guard
    await act(async () => {
      await router.replace('/about');
    });
    expect(router.pathname).toBe('/users/blocked');
  });

  it('history actions (go, goBack, goForward)', () => {
    const router = createRouter({
      routes,
      initialUrl: '/',
    });
    
    window.history.go = vi.fn();
    window.history.back = vi.fn();
    window.history.forward = vi.fn();

    router.go(-2);
    expect(window.history.go).toHaveBeenCalledWith(-2);

    router.goBack();
    expect(window.history.back).toHaveBeenCalled();

    router.goForward();
    expect(window.history.forward).toHaveBeenCalled();
  });

  it('popstate promise-based redirect and error handling', async () => {
    let popStateCallback: any = null;
    vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
      if (event === 'popstate') {
        popStateCallback = callback;
      }
    });

    const beforeNavigate = vi.fn().mockImplementation((from, to) => {
      if (to.pathname === '/about') {
        return Promise.resolve('/users/redirected');
      }
      if (to.pathname === '/files/error') {
        return Promise.reject(new Error('Auth failed'));
      }
      return Promise.resolve(true);
    });

    const router = createRouter({
      routes,
      initialUrl: '/',
      beforeNavigate,
    });

    expect(popStateCallback).toBeTypeOf('function');

    // 1. PopState promise-based redirect
    vi.stubGlobal('location', { pathname: '/about', search: '', hash: '' });
    await act(async () => {
      popStateCallback(new PopStateEvent('popstate', { state: null }));
    });
    expect(router.pathname).toBe('/users/redirected');

    // 2. PopState promise rejection (should revert URL)
    vi.stubGlobal('location', { pathname: '/files/error', search: '', hash: '' });
    await act(async () => {
      popStateCallback(new PopStateEvent('popstate', { state: null }));
    });
    // Reverts to the previous pathname (/users/redirected)
    expect(router.pathname).toBe('/users/redirected');
  });

  it('popstate listener cleanup on destroy', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    
    const router = createRouter({
      routes,
      initialUrl: '/',
    });

    destroy(router);

    expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
  });

});

