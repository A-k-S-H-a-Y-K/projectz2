import { useEffect, useState, type FormEvent } from 'react';
import { demoLogin, getConfig, login, signup, type AuthConfig, type AuthResponse } from '../api';

const FEATURES = [
  'Answers grounded in your own notes, with numbered citations',
  'Hybrid search: meaning-based and exact-word matching combined',
  'Streaming answers and prompt-injection protection',
];

export default function LoginPage({ onSignIn }: { onSignIn: (auth: AuthResponse) => void }) {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', inviteCode: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch(() => setConfig({ signupMode: 'closed', demoEnabled: true }));
  }, []);

  const run = async (action: () => Promise<AuthResponse>) => {
    setBusy(true);
    setError(null);
    try {
      onSignIn(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    run(() =>
      mode === 'login'
        ? login(form.email, form.password)
        : signup({ ...form, inviteCode: form.inviteCode || undefined })
    );
  };

  const field = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [name]: e.target.value }),
  });

  const canSignUp = config !== null && config.signupMode !== 'closed';

  return (
    <div className="login">
      <section className="hero">
        <h1>Memory Assistant</h1>
        <p className="lead">Save notes, then ask questions about them in plain English.</p>
        <ul className="features">
          {FEATURES.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>

      <section className="card auth">
        {config?.demoEnabled && (
          <>
            <button className="primary wide" disabled={busy} onClick={() => run(demoLogin)}>
              Try the demo
            </button>
            <p className="muted small">
              Explore 26 sample notes and ask questions about them. No account needed.
            </p>
            <div className="divider">or</div>
          </>
        )}

        <form onSubmit={submit} className="stack">
          {mode === 'signup' && (
            <input placeholder="Name" required minLength={2} maxLength={50} {...field('name')} />
          )}
          <input type="email" placeholder="Email" required {...field('email')} />
          <input
            type="password"
            placeholder="Password"
            required
            minLength={mode === 'signup' ? 8 : undefined}
            {...field('password')}
          />
          {mode === 'signup' && config?.signupMode === 'invite' && (
            <input placeholder="Invite code" required {...field('inviteCode')} />
          )}
          <button type="submit" disabled={busy}>
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        {canSignUp && (
          <button
            className="link small"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
            }}
          >
            {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
          </button>
        )}
      </section>
    </div>
  );
}
