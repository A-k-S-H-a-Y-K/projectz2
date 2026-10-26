// The shared, read-only demo account. It has no usable password: visitors get a token
// from POST /auth/demo, and `npm run demo:seed` fills it with sample memories.
export const DEMO_EMAIL = 'demo@memory-assistant.local';
export const DEMO_NAME = 'Demo User';

export const isDemoEnabled = () => process.env.DEMO_ENABLED !== 'false';

// Who may create accounts: open (anyone), invite (needs INVITE_CODE) or closed.
// Defaults to closed in production and open everywhere else.
export type SignupMode = 'open' | 'invite' | 'closed';

export function signupMode(): SignupMode {
  const mode = process.env.SIGNUP_MODE;
  if (mode === 'open' || mode === 'invite' || mode === 'closed') return mode;
  return process.env.NODE_ENV === 'production' ? 'closed' : 'open';
}
