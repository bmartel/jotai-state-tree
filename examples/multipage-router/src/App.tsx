import React, { useState } from 'react';
import { observer, RouteView, useRouter, RouterContext } from 'jotai-state-tree/react';
import { createAppStore, IRootStore } from './store';

export const StoreContext = React.createContext<IRootStore | null>(null);

export function useAppStore() {
  const store = React.useContext(StoreContext);
  if (!store) {
    throw new Error('[jotai-state-tree] useAppStore must be used within StoreContext.Provider');
  }
  return store;
}

// ============================================================================
// Custom Link Component
// ============================================================================
// Facilitates client-side SPA navigation without page reloads
interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  activeClassName?: string;
  exact?: boolean;
}

const Link = observer(function Link({ to, children, className = '', activeClassName = '', exact = false, ...rest }: LinkProps) {
  const activeRouter = useRouter();
  
  // Parse target pathname to check active state
  const targetPath = to.split('?')[0].split('#')[0];
  const isActive = exact 
    ? activeRouter.pathname === targetPath
    : activeRouter.pathname.startsWith(targetPath) && (targetPath !== '/' || activeRouter.pathname === '/');

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    activeRouter.push(to);
  };

  return (
    <a
      href={to}
      onClick={handleClick}
      className={`${className} ${isActive ? activeClassName : ''}`}
      {...rest}
    >
      {children}
    </a>
  );
});

// ============================================================================
// SVG Icons
// ============================================================================
const Icons = {
  Book: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.5em', height: '1.5em' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  Home: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.2em', height: '1.2em' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  Catalog: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.2em', height: '1.2em' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.007 5.25H3.75v.008h.008V12zm0 5.25H3.75v.008h.008v-.008z" />
    </svg>
  ),
  Admin: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.2em', height: '1.2em' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  Files: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.2em', height: '1.2em' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  Lock: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.2em', height: '1.2em', display: 'inline' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  Redirect: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.5em', height: '1.5em', color: '#fbbf24' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5A5.25 5.25 0 0021 11.25V9.75" />
    </svg>
  )
};

// ============================================================================
// Page 1: Home View
// ============================================================================
const HomeView = observer(function HomeView() {
  const activeRouter = useRouter();

  return (
    <div>
      <h1 className="page-title">Welcome to State Bookshop</h1>
      <p className="page-desc">
        This template demonstrates the integration of a client-side data-driven router directly in the <strong>jotai-state-tree</strong> state tree. Navigation guards, query parameters, route patterns, and history management are all tracked as reactive properties.
      </p>

      <div className="home-grid">
        <div className="home-card">
          <div className="home-card-icon"><Icons.Catalog /></div>
          <h3 className="home-card-title">Dynamic Param Matching</h3>
          <p className="home-card-desc">
            Define parameter rules like <code>/books/:id</code> in your routes. The route parameters are automatically parsed and injected directly as props into your pages.
          </p>
          <button onClick={() => activeRouter.push('/books/3')}>View Book #3 (Dune)</button>
        </div>

        <div className="home-card">
          <div className="home-card-icon"><Icons.Files /></div>
          <h3 className="home-card-title">Wildcard Path Matching</h3>
          <p className="home-card-desc">
            Match deep folder paths using wildcards like <code>/files/*</code>. Useful for asset managers, documentation guides, or nesting navigation trees.
          </p>
          <button onClick={() => activeRouter.push('/files/documents/chapters/intro.pdf')}>Open Wildcard File</button>
        </div>

        <div className="home-card">
          <div className="home-card-icon"><Icons.Admin /></div>
          <h3 className="home-card-title">Navigation Guards</h3>
          <p className="home-card-desc">
            Protect routes using <code>beforeNavigate</code>. If you visit the admin panel without being logged in, you will be intercepted and redirected to the login screen.
          </p>
          <button onClick={() => activeRouter.push('/admin')}>Visit Protected Admin</button>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Page 2: Book Catalog (with query search and sidebar filters)
// ============================================================================
const BookListView = observer(function BookListView() {
  const activeRouter = useRouter();
  const store = useAppStore();
  const [localSearch, setLocalSearch] = useState(activeRouter.query.search || '');

  // Active filters from URL query parameters
  const activeCategory = activeRouter.query.category || 'All';
  const activeSearch = activeRouter.query.search || '';

  // Filter books reactively based on URL state
  const filteredBooks = store.books.filter(book => {
    const matchesCategory = activeCategory === 'All' || book.category === activeCategory;
    const matchesSearch = !activeSearch || 
      book.title.toLowerCase().includes(activeSearch.toLowerCase()) ||
      book.author.toLowerCase().includes(activeSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams();
    if (category !== 'All') params.set('category', category);
    if (activeSearch) params.set('search', activeSearch);
    
    const queryString = params.toString();
    activeRouter.push(`/books${queryString ? '?' + queryString : ''}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (activeCategory !== 'All') params.set('category', activeCategory);
    if (localSearch.trim()) params.set('search', localSearch.trim());
    
    const queryString = params.toString();
    activeRouter.push(`/books${queryString ? '?' + queryString : ''}`);
  };

  const handleClearSearch = () => {
    setLocalSearch('');
    const params = new URLSearchParams();
    if (activeCategory !== 'All') params.set('category', activeCategory);
    
    const queryString = params.toString();
    activeRouter.push(`/books${queryString ? '?' + queryString : ''}`);
  };

  return (
    <div>
      <h1 className="page-title">Book Catalog</h1>
      <p className="page-desc">
        Search and filter products. Category selections and search inputs are mapped directly to URL query parameters.
      </p>

      <div className="catalog-container">
        {/* Left Category Sidebar */}
        <aside>
          <h3 className="panel-title">Categories</h3>
          <div className="category-list">
            {['All', 'Tech', 'Sci-Fi', 'Fantasy'].map(cat => (
              <button
                key={cat}
                className={`category-item ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => handleCategoryChange(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </aside>

        {/* Right Catalog View */}
        <div className="catalog-main">
          <form onSubmit={handleSearchSubmit} className="search-bar">
            <div className="search-input-wrapper">
              <input
                type="text"
                placeholder="Search by title or author..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="primary">Search</button>
            {activeSearch && (
              <button type="button" onClick={handleClearSearch}>Clear</button>
            )}
          </form>

          {filteredBooks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--fg-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              No books found matching the current filters.
            </div>
          ) : (
            <div className="books-grid">
              {filteredBooks.map(book => (
                <div 
                  key={book.id} 
                  className="book-card"
                  onClick={() => activeRouter.push(`/books/${book.id}`)}
                >
                  <span className="book-category">{book.category}</span>
                  <h3 className="book-title">{book.title}</h3>
                  <span className="book-author">by {book.author}</span>
                  <span className="book-price">${book.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Page 3: Book Detail (receives path parameter 'id' as a prop)
// ============================================================================
interface BookDetailProps {
  id: string;
}

const BookDetailView = observer(function BookDetailView({ id }: BookDetailProps) {
  const activeRouter = useRouter();
  const store = useAppStore();
  
  const book = store.books.find(b => b.id === id);

  if (!book) {
    return (
      <div className="detail-card" style={{ border: '1px solid var(--color-danger)' }}>
        <h2 style={{ margin: 0, color: 'var(--color-danger)' }}>Book Not Found</h2>
        <p>No book with ID "{id}" exists in our catalog.</p>
        <button onClick={() => activeRouter.push('/books')}>Back to Catalog</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <button onClick={() => activeRouter.goBack()}>&larr; Go Back</button>
      </div>

      <div className="detail-card">
        <span className="book-category">{book.category}</span>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '28px' }}>{book.title}</h1>
        <div className="detail-meta">
          <span>Author: <strong>{book.author}</strong></span>
          <span>&bull;</span>
          <span>Book ID: <strong>{book.id}</strong></span>
        </div>
        <div className="detail-price">${book.price.toFixed(2)}</div>
        <p className="detail-synopsis">
          <strong>Synopsis:</strong><br />
          {book.synopsis}
        </p>
      </div>
    </div>
  );
});

// ============================================================================
// Page 4: Protected Admin Panel
// ============================================================================
const AdminView = observer(function AdminView() {
  const activeRouter = useRouter();
  const store = useAppStore();
  const totalBooks = store.books.length;
  const categories = Array.from(new Set(store.books.map(b => b.category))).length;

  return (
    <div>
      <h1 className="page-title">Admin Dashboard</h1>
      <p className="page-desc">
        Welcome to the secure administrative interface. Access to this page is verified by our route navigation guards.
      </p>

      <div className="admin-metrics">
        <div className="metric-card">
          <span className="metric-label">Logged In As</span>
          <span className="metric-value" style={{ color: 'var(--color-primary)' }}>
            {store.auth.currentUser || 'Administrator'}
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Total Products</span>
          <span className="metric-value">{totalBooks}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Categories</span>
          <span className="metric-value">{categories}</span>
        </div>
      </div>

      <div className="admin-logs-card">
        <h3 className="panel-title" style={{ justifyContent: 'space-between' }}>
          <span>Navigation Guard Activity Log</span>
          <button style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => store.clearLogs()}>
            Clear Logs
          </button>
        </h3>
        <ul className="log-list" style={{ maxHeight: '200px' }}>
          {[...store.navigationLogs].reverse().map(log => (
            <li key={log.id} className="log-item">
              <div className="log-meta">
                <span>Timestamp: {log.timestamp}</span>
              </div>
              <span className="log-msg">{log.message}</span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: '24px' }}>
        <button 
          className="danger" 
          onClick={() => {
            store.auth.logout();
            activeRouter.push('/');
          }}
        >
          Logout of Session
        </button>
      </div>
    </div>
  );
});

// ============================================================================
// Page 5: Login Screen
// ============================================================================
const LoginView = observer(function LoginView() {
  const activeRouter = useRouter();
  const store = useAppStore();
  const [username, setUsername] = useState('');
  
  const redirectTarget = activeRouter.query.redirect || '/';
  const wasRedirected = !!activeRouter.query.redirect;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    store.auth.login(username);
    
    // Redirect back to target URL or home
    activeRouter.replace(decodeURIComponent(redirectTarget));
  };

  return (
    <div style={{ padding: '20px 0' }}>
      <form onSubmit={handleLogin} className="form-card">
        <div>
          <h2 style={{ margin: '0 0 6px 0' }}>Administrative Login</h2>
          <p className="subtitle" style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>
            Log in to access administrative pages and dashboards.
          </p>
        </div>

        {wasRedirected && (
          <div className="auth-alert">
            <Icons.Redirect />
            <span>You were redirected because access to <strong>{decodeURIComponent(redirectTarget)}</strong> requires login.</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            placeholder="Enter your name (e.g. brandon)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </div>

        <button type="submit" className="primary" disabled={!username.trim()}>
          Login & Continue
        </button>
      </form>
    </div>
  );
});

// ============================================================================
// Page 6: Wildcard Files View
// ============================================================================
// The RouteView component maps wildcard routes like /files/* to a prop named '*'
interface WildcardFilesProps {
  '*': string;
}

const WildcardFilesView = observer(function WildcardFilesView(props: WildcardFilesProps) {
  const activeRouter = useRouter();
  const filePath = props['*'] || '';

  return (
    <div>
      <h1 className="page-title">Wildcard File Browser</h1>
      <p className="page-desc">
        This route uses a wildcard definition (<code>/files/*</code>). The matching folder segment is captured and made available via the router parameters.
      </p>

      <div className="wildcard-box">
        <h3 style={{ margin: 0 }}>Captured Wildcard Parameter:</h3>
        <div className="wildcard-path">{filePath || '(root directory)'}</div>
        <p style={{ fontSize: '14px', color: 'var(--fg-muted)', margin: '8px 0 16px 0' }}>
          By defining a wildcard, the router returns the entire remaining path segment inside <code>router.params['*']</code>.
        </p>

        <h4 className="panel-title" style={{ margin: '8px 0' }}>Test other wildcard paths:</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => activeRouter.push('/files/images/covers/dune.jpg')}>
            dune.jpg
          </button>
          <button onClick={() => activeRouter.push('/files/downloads/manual.pdf')}>
            manual.pdf
          </button>
          <button onClick={() => activeRouter.push('/files/receipts/2026/invoice_882.html')}>
            invoice_882.html
          </button>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Page Map Configuration
// ============================================================================
const pages = {
  home: HomeView,
  books: BookListView,
  'book-details': BookDetailView,
  admin: AdminView,
  login: LoginView,
  files: WildcardFilesView,
};

// ============================================================================
// Navbar Component
// ============================================================================
const Navbar = observer(function Navbar() {
  const activeRouter = useRouter();
  const store = useAppStore();
  const auth = store.auth;

  return (
    <header className="app-header">
      <Link to="/" className="brand" exact>
        <Icons.Book />
        <span className="brand-text">State Bookshop</span>
      </Link>

      <nav className="nav-links">
        <Link to="/" className="nav-item" activeClassName="active" exact>
          <Icons.Home />
          Home
        </Link>
        <Link to="/books" className="nav-item" activeClassName="active">
          <Icons.Catalog />
          Catalog
        </Link>
        <Link to="/admin" className="nav-item" activeClassName="active">
          <Icons.Admin />
          Admin Panel
        </Link>
        <Link to="/files" className="nav-item" activeClassName="active">
          <Icons.Files />
          Files
        </Link>
      </nav>

      <div className="auth-status">
        {auth.isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="user-badge">
              <div className="avatar">{(auth.currentUser || 'A')[0].toUpperCase()}</div>
              <span>{auth.currentUser}</span>
            </div>
            <button 
              style={{ padding: '6px 12px', fontSize: '12px' }} 
              onClick={() => {
                auth.logout();
                activeRouter.push('/');
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <button 
            style={{ padding: '6px 12px', fontSize: '12px' }} 
            onClick={() => activeRouter.push('/login')}
          >
            <Icons.Lock />
            Admin Login
          </button>
        )}
      </div>
    </header>
  );
});

// ============================================================================
// DevTools State Inspector Sidebar
// ============================================================================
const DevToolsInspector = observer(function DevToolsInspector() {
  const activeRouter = useRouter();
  const store = useAppStore();

  return (
    <aside className="inspector-sidebar">
      <div>
        <h3 className="panel-title">Router State Tree</h3>
        <div className="inspector-card">
          <div className="state-row">
            <span className="state-label">pathname:</span>
            <span className="state-value" style={{ color: '#60a5fa' }}>"{activeRouter.pathname}"</span>
          </div>
          <div className="state-row">
            <span className="state-label">action:</span>
            <span className={`state-value action-${activeRouter.action.toLowerCase()}`}>
              {activeRouter.action}
            </span>
          </div>
          <div className="state-row">
            <span className="state-label">routeName:</span>
            <span className="state-value" style={{ color: '#34d399' }}>
              {activeRouter.currentRouteName ? `"${activeRouter.currentRouteName}"` : 'null'}
            </span>
          </div>
          <div className="state-row" style={{ flexDirection: 'column', gap: '4px', borderBottom: 'none' }}>
            <span className="state-label">params:</span>
            <pre style={{ margin: 0, padding: '8px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', fontSize: '11px', color: '#fda4af', overflowX: 'auto' }}>
              {JSON.stringify(activeRouter.params, null, 2)}
            </pre>
          </div>
          <div className="state-row" style={{ flexDirection: 'column', gap: '4px', borderBottom: 'none', paddingTop: '12px' }}>
            <span className="state-label">query:</span>
            <pre style={{ margin: 0, padding: '8px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', fontSize: '11px', color: '#fcd34d', overflowX: 'auto' }}>
              {JSON.stringify(activeRouter.query, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      <div>
        <h3 className="panel-title">History Controls</h3>
        <div className="inspector-card" style={{ display: 'flex', gap: '8px' }}>
          <button style={{ flex: 1, fontSize: '12px', padding: '6px' }} onClick={() => activeRouter.goBack()}>
            &larr; Back
          </button>
          <button style={{ flex: 1, fontSize: '12px', padding: '6px' }} onClick={() => activeRouter.goForward()}>
            Forward &rarr;
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <h3 className="panel-title">Logs Output</h3>
        <div className="inspector-card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: '120px' }}>
          <ul className="log-list" style={{ flex: 1 }}>
            {[...store.navigationLogs].reverse().map(log => (
              <li key={log.id} className="log-item">
                <span className="log-meta">
                  <span>{log.timestamp}</span>
                </span>
                <span className="log-msg">{log.message}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
});

// ============================================================================
// App Component Entrypoint
// ============================================================================
export const App = observer(function App() {
  const { store, router } = React.useMemo(() => createAppStore(), []);

  return (
    <StoreContext.Provider value={store}>
      <RouterContext.Provider value={router}>
        <div className="app-container">
          <Navbar />

          <div className="main-layout">
            <main className="content-area">
              <RouteView 
                pages={pages} 
                fallback={
                  <div style={{ padding: '40px 0', textAlign: 'center' }}>
                    <h2>Page Not Found</h2>
                    <p>The URL you requested does not map to any defined page.</p>
                    <Link to="/" className="nav-item active" style={{ display: 'inline-flex', width: 'fit-content', margin: '16px auto 0 auto' }}>
                      Go to Home Page
                    </Link>
                  </div>
                }
              />
            </main>

            <DevToolsInspector />
          </div>
        </div>
      </RouterContext.Provider>
    </StoreContext.Provider>
  );
});
