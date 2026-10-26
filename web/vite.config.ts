import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // In development, /api/* is forwarded to the backend, so the browser talks to one
    // origin and no CORS setup is needed. In production, VITE_API_URL points at the API.
    proxy: {
      '/api': {
        // 127.0.0.1 rather than localhost, which Node may resolve to IPv6 (::1)
        target: 'http://127.0.0.1:3001',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
