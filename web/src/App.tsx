import { useCallback, useEffect, useState } from 'react';
import { getSession, setUnauthorizedHandler, tokenStore, type AuthResponse, type Session } from './api';
import LoginPage from './pages/LoginPage';
import AskPage from './pages/AskPage';
import MemoriesPage from './pages/MemoriesPage';

type Tab = 'ask' | 'memories';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  // Only show a loading state if there's a saved login to check
  const [restoring, setRestoring] = useState(() => tokenStore.get() !== null);
  const [tab, setTab] = useState<Tab>('ask');

  const logout = useCallback(() => {
    tokenStore.clear();
    setSession(null);
  }, []);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  // Restore the previous session after a page reload
  useEffect(() => {
    if (!tokenStore.get()) return;
    getSession()
      .then(setSession)
      .catch(() => tokenStore.clear())
      .finally(() => setRestoring(false));
  }, []);

  const signIn = (auth: AuthResponse) => {
    tokenStore.set(auth.token);
    setSession({ user: auth.user, demo: auth.demo });
    setTab('ask');
  };

  if (restoring) return <p className="center muted">Loading…</p>;
  if (!session) return <LoginPage onSignIn={signIn} />;

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Memory Assistant</span>
        <nav className="tabs">
          <button className={tab === 'ask' ? 'tab active' : 'tab'} onClick={() => setTab('ask')}>
            Ask
          </button>
          <button
            className={tab === 'memories' ? 'tab active' : 'tab'}
            onClick={() => setTab('memories')}
          >
            Memories
          </button>
        </nav>
        <div className="account">
          {session.demo && <span className="badge">Read-only demo</span>}
          <span className="muted">{session.user.name}</span>
          <button className="link" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="container">
        {tab === 'ask' ? <AskPage demo={session.demo} /> : <MemoriesPage readOnly={session.demo} />}
      </main>
    </div>
  );
}
