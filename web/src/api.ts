// Client for the Memory Assistant API: attaches the login token, turns error responses
// into readable messages, and reads streamed answers.

// Same-origin /api in development (proxied by Vite); the deployed API's URL in production
const API_URL = import.meta.env.VITE_API_URL ?? '/api';
const TOKEN_KEY = 'memory-assistant-token';

export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export interface Memory {
  id: number;
  userId: number;
  title: string | null;
  content: string;
  tags: string[];
  createdAt: string;
}

export interface Reference extends Memory {
  score: number | null;
  matchedBy: ('semantic' | 'keyword')[];
  suspicious: boolean;
  citation: number | null;
  cited: boolean;
}

export interface Session {
  user: User;
  demo: boolean;
}

export interface AuthResponse extends Session {
  token: string;
}

export interface AuthConfig {
  signupMode: 'open' | 'invite' | 'closed';
  demoEnabled: boolean;
}

export interface MemoryPage {
  memories: Memory[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

// localStorage can be unavailable (e.g. some private browsing modes), so failures are ignored
export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // The session just won't survive a page reload
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing stored
    }
  },
};

// Called when a request with a token gets 401, i.e. the session has expired
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

function errorMessage(status: number, body: { error?: unknown; retryAfterSeconds?: number }) {
  if (status === 429 && typeof body.error === 'string') {
    const minutes = Math.ceil((body.retryAfterSeconds ?? 60) / 60);
    return `${body.error} (about ${minutes} min)`;
  }
  // Validation failures return a structured error rather than a message
  if (typeof body.error === 'string') return body.error;
  if (status === 400) return 'Please check what you entered and try again.';
  return 'Something went wrong. Please try again.';
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const token = tokenStore.get();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(errorMessage(res.status, body), res.status);
  }
  return res;
}

const getJson = async <T>(path: string, init?: RequestInit) =>
  (await send(path, init)).json() as Promise<T>;

const postJson = <T>(path: string, body?: unknown) =>
  getJson<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const getConfig = () => getJson<AuthConfig>('/auth/config');
export const getSession = () => getJson<Session>('/auth/session');
export const demoLogin = () => postJson<AuthResponse>('/auth/demo');
export const login = (email: string, password: string) =>
  postJson<AuthResponse>('/auth/login', { email, password });
export const signup = (details: { name: string; email: string; password: string; inviteCode?: string }) =>
  postJson<AuthResponse>('/auth/signup', details);

export function listMemories(options: { page?: number; search?: string; tag?: string } = {}) {
  const params = new URLSearchParams({ page: String(options.page ?? 1), limit: '20' });
  if (options.search) params.set('search', options.search);
  if (options.tag) params.set('tags', options.tag);
  return getJson<MemoryPage>(`/memories?${params}`);
}

export const createMemory = (memory: { title?: string; content: string; tags: string[] }) =>
  postJson<Memory>('/memories', memory);

export const deleteMemory = (id: number) => send(`/memories/${id}`, { method: 'DELETE' });

// Asks a question through the streaming endpoint. Sources arrive first, then the answer
// in pieces, then the citation numbers the answer used.
export async function askStream(
  query: string,
  includeGeneralKnowledge: boolean,
  handlers: {
    onReferences: (references: Reference[]) => void;
    onToken: (text: string) => void;
    onDone: (cited: number[]) => void;
  },
  signal?: AbortSignal
) {
  const res = await send('/ai/search/stream', {
    method: 'POST',
    body: JSON.stringify({ query, includeGeneralKnowledge }),
    signal,
  });
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();

  let finished = false;

  // Server-Sent Events are separated by a blank line; each has "event:" and "data:" lines
  const handle = (message: string) => {
    const event = /^event: (.*)$/m.exec(message)?.[1];
    const data = [...message.matchAll(/^data: (.*)$/gm)].map((match) => match[1]).join('\n');
    if (!event || !data) return;

    const payload = JSON.parse(data);
    if (event === 'references') handlers.onReferences(payload);
    else if (event === 'token') handlers.onToken(payload.text);
    else if (event === 'done') {
      finished = true;
      handlers.onDone(payload.cited);
    } else if (event === 'error') throw new ApiError(payload.error, 500);
  };

  let buffer = '';
  for (;;) {
    let chunk: ReadableStreamReadResult<string>;
    try {
      chunk = await reader.read();
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      throw new ApiError('The connection was lost while answering. Please try again.', 0);
    }
    if (chunk.done) break;
    buffer += chunk.value;
    const messages = buffer.split('\n\n');
    buffer = messages.pop() ?? '';
    messages.forEach(handle);
  }

  // The stream closed without its final event, e.g. the server restarted mid-answer
  if (!finished) {
    throw new ApiError('The answer was interrupted. Please try again.', 0);
  }
}
