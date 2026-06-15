/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createRouter, normalizePathname, matchRoutes, parseUrl } from '../router';
import { RouterContext, RouteView, useRouter } from '../react';
import { clearAllRegistries, resetGlobalStore, destroy, unprotect } from '../index';

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
    expect(window.history.replaceState).toHaveBeenCalledWith(undefined, '', '/users/redirected');
    expect(window.history.pushState).not.toHaveBeenCalled();

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

  it('wildcard matching and segment length limit in matchPath', () => {
    // 1. matchPath with * or /*
    const r = createRouter({
      routes: [
        { path: '/*', name: 'wildcard' },
      ],
      initialUrl: '/some/nested/path',
    });
    expect(r.currentRouteName).toBe('wildcard');
    expect(r.params).toEqual({ '*': '/some/nested/path' });

    // 2. matchPath segment length limit
    const r2 = createRouter({
      routes: [
        { path: '/a/b/*', name: 'wildcard-segment' },
      ],
      initialUrl: '/a',
    });
    expect(r2.currentRouteName).toBeNull();
  });

  it('afterNavigate inside replace action', async () => {
    const afterSpy = vi.fn();
    const rReplace = createRouter({
      routes,
      initialUrl: '/',
      afterNavigate: afterSpy,
    });
    await act(async () => {
      await rReplace.replace('/about');
    });
    expect(afterSpy).toHaveBeenCalled();
  });

  it('popstate listener sync beforeNavigate and empty beforeNavigate options', async () => {
    let popStateCallback: any = null;
    const addListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
      if (event === 'popstate') {
        popStateCallback = callback;
      }
    });

    // 1. popstate with no beforeNavigate hook
    const r1 = createRouter({
      routes,
      initialUrl: '/',
    });
    vi.stubGlobal('location', { pathname: '/about', search: '', hash: '', href: 'http://localhost/about' });
    popStateCallback(new PopStateEvent('popstate', { state: 'some-state' }));
    expect(r1.pathname).toBe('/about');

    // 2. popstate with sync beforeNavigate returning true
    const r2 = createRouter({
      routes,
      initialUrl: '/',
      beforeNavigate: () => true,
    });
    vi.stubGlobal('location', { pathname: '/about', search: '', hash: '', href: 'http://localhost/about' });
    popStateCallback(new PopStateEvent('popstate', { state: null }));
    expect(r2.pathname).toBe('/about');

    // 3. popstate with sync beforeNavigate returning false (should revert state)
    const r3 = createRouter({
      routes,
      initialUrl: '/about',
      beforeNavigate: () => false,
    });
    vi.stubGlobal('location', { pathname: '/files/secret', search: '', hash: '', href: 'http://localhost/files/secret' });
    window.history.replaceState = vi.fn();
    popStateCallback(new PopStateEvent('popstate', { state: null }));
    expect(r3.pathname).toBe('/about');
    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/about");

    // 4. popstate with sync beforeNavigate returning a redirect path
    const r4 = createRouter({
      routes,
      initialUrl: '/',
      beforeNavigate: (from, to) => {
        if (to.pathname === '/about') {
          return '/users/redirected';
        }
        return true;
      },
    });
    vi.stubGlobal('location', { pathname: '/about', search: '', hash: '', href: 'http://localhost/about' });
    await act(async () => {
      popStateCallback(new PopStateEvent('popstate', { state: null }));
    });
    expect(r4.pathname).toBe('/users/redirected');
    expect(window.history.replaceState).toHaveBeenCalledWith(undefined, '', '/users/redirected');
    expect(window.history.pushState).not.toHaveBeenCalled();

    // 5. popstate with async beforeNavigate resolving to false
    const r5 = createRouter({
      routes,
      initialUrl: '/about',
      beforeNavigate: () => Promise.resolve(false),
    });
    vi.stubGlobal('location', { pathname: '/files/secret', search: '', hash: '', href: 'http://localhost/files/secret' });
    window.history.replaceState = vi.fn();
    await act(async () => {
      popStateCallback(new PopStateEvent('popstate', { state: null }));
    });
    expect(r5.pathname).toBe('/about');
    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/about");

    addListenerSpy.mockRestore();
  });

  it('useRouter successfully called inside RouterContext.Provider', () => {
    const router = createRouter({
      routes,
      initialUrl: '/',
    });
    const TestComp = () => {
      const activeRouter = useRouter();
      expect(activeRouter).toBe(router);
      return null;
    };
    render(
      <RouterContext.Provider value={router}>
        <TestComp />
      </RouterContext.Provider>
    );
  });

  it('useRouter successfully called inside RouterContext.Provider with plain object router', () => {
    const plainRouter = { currentRoute: { path: '/' } };
    const TestComp = () => {
      const activeRouter = useRouter();
      expect(activeRouter).toBe(plainRouter);
      return null;
    };
    render(
      <RouterContext.Provider value={plainRouter}>
        <TestComp />
      </RouterContext.Provider>
    );
  });

  it('router extra edge cases and branch coverage', async () => {
    // 1. parseUrl with // and query string decoding value branches
    const parsed1 = parseUrl('//localhost/about?&name&a=1');
    expect(parsed1.pathname).toBe('/about');
    expect(parsed1.query.name).toBe('');
    expect(parsed1.query.a).toBe('1');

    // 2. currentRoute view when route is not found (find returns undefined)
    const r = createRouter({ routes, initialUrl: '/' });
    unprotect(r);
    r.currentRouteName = 'non-existent';
    expect(r.currentRoute).toBeNull();

    // 3. push/replace to unmatched path
    await act(async () => {
      await r.push('/unmatched-path');
    });
    expect(r.currentRouteName).toBeNull();
    await act(async () => {
      await r.replace('/another-unmatched');
    });
    expect(r.currentRouteName).toBeNull();

    // 4. popstate with async beforeNavigate resolving to redirect string and afterNavigate hook
    const afterSpy = vi.fn();
    let popStateCallback: any = null;
    const addListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
      if (event === 'popstate') {
        popStateCallback = callback;
      }
    });
    // Create new router to capture listener
    const rPopTrigger = createRouter({
      routes,
      initialUrl: '/',
      beforeNavigate: (from, to) => to.pathname === '/about' ? Promise.resolve(true) : Promise.resolve('/about'),
      afterNavigate: afterSpy,
    });
    vi.stubGlobal('location', { pathname: '/users/123', search: '', hash: '', href: 'http://localhost/users/123' });
    await act(async () => {
      popStateCallback(new PopStateEvent('popstate', { state: null }));
    });
    expect(rPopTrigger.pathname).toBe('/about');
    expect(afterSpy).toHaveBeenCalled();
    addListenerSpy.mockRestore();
  });

  it('router additional coverage edge cases', async () => {
    // 1. popstate with async beforeNavigate resolving to true and afterNavigate hook
    const afterSpy = vi.fn();
    let popStateCallback: any = null;
    const addListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
      if (event === 'popstate') {
        popStateCallback = callback;
      }
    });
    const rPopTrue = createRouter({
      routes,
      initialUrl: '/',
      beforeNavigate: (from, to) => Promise.resolve(true),
      afterNavigate: afterSpy,
    });
    vi.stubGlobal('location', { pathname: '/about', search: '', hash: '', href: 'http://localhost/about' });
    await act(async () => {
      popStateCallback(new PopStateEvent('popstate', { state: null }));
    });
    expect(rPopTrue.pathname).toBe('/about');
    expect(afterSpy).toHaveBeenCalled();
    addListenerSpy.mockRestore();

    // 2. popstate to unmatched route (matched is falsy)
    let popStateCallback2: any = null;
    const addListenerSpy2 = vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
      if (event === 'popstate') {
        popStateCallback2 = callback;
      }
    });
    const rPopUnmatched = createRouter({
      routes,
      initialUrl: '/',
    });
    vi.stubGlobal('location', { pathname: '/unknown-route-pop', search: '', hash: '', href: 'http://localhost/unknown-route-pop' });
    await act(async () => {
      popStateCallback2(new PopStateEvent('popstate', { state: null }));
    });
    expect(rPopUnmatched.currentRouteName).toBeNull();
    addListenerSpy2.mockRestore();

    // 3. destroy router where _popStateListener is null
    const rDestroy = createRouter({ routes, initialUrl: '/' });
    rDestroy.setPopStateListener(null);
    expect(() => destroy(rDestroy)).not.toThrow();

    // 4. useRouter called inside Provider
    const mockRouterInstance = createRouter({ routes, initialUrl: '/' });
    const TestCompGood = () => {
      const router = useRouter();
      return <div data-testid="router-ok">{router ? 'ok' : 'no'}</div>;
    };
    render(
      <RouterContext.Provider value={mockRouterInstance}>
        <TestCompGood />
      </RouterContext.Provider>
    );
    expect(screen.getByTestId('router-ok').textContent).toBe('ok');

    // 5. _setPopStateRef
    const rSetRef = createRouter({ routes, initialUrl: '/' });
    const dummyRef = { current: null };
    (rSetRef as any)._setPopStateRef(dummyRef);
    expect((rSetRef as any)._popStateRef).toBe(dummyRef);
  });
});

