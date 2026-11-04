// Which deployment this process is, read once at startup (Users & Roles plan 3.6).
// NODE_ENV says how the process runs; APP_ENV says which deployment it is: staging or production.
// SCOPE_MODE: 'strict' denies out-of-scope rows; 'log' only records would-deny lines and is allowed on staging alone.
export type AppEnv = 'staging' | 'production';
export type ScopeMode = 'log' | 'strict';
export interface AppConfig { appEnv: AppEnv | null; scopeMode: ScopeMode }

export function loadAppConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const raw = (env.APP_ENV ?? '').trim();
  const appEnv: AppEnv | null = raw === 'staging' || raw === 'production' ? raw : null;
  // A real deployment must say what it is: a missing or misspelled marker stops the start (fail closed)
  if (env.NODE_ENV === 'production' && !appEnv) {
    throw new Error(`APP_ENV must be "staging" or "production" when NODE_ENV=production (found ${raw ? `"${raw}"` : 'nothing'}). Refusing to start.`);
  }
  // An unset or unknown value means strict, never the looser mode
  const scopeMode: ScopeMode = (env.SCOPE_MODE ?? '').trim() === 'log' ? 'log' : 'strict';
  if (scopeMode === 'log' && appEnv !== 'staging') {
    throw new Error('SCOPE_MODE=log is only allowed with APP_ENV=staging. Refusing to start.');
  }
  return { appEnv, scopeMode };
}
