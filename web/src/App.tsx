import { useEffect, useState } from 'react';

// Same-origin /api in development (proxied by Vite); the deployed API's URL in production
const API_URL = import.meta.env.VITE_API_URL ?? '/api';

// Temporary page that checks the frontend can reach the backend
export default function App() {
  const [status, setStatus] = useState('checking...');

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((body: { status: string }) => setStatus(body.status))
      .catch(() => setStatus('unreachable (is the backend running?)'));
  }, []);

  return (
    <main>
      <h1>Memory Assistant</h1>
      <p>Backend: {status}</p>
    </main>
  );
}
