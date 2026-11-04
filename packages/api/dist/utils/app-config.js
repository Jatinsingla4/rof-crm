"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAppConfig = loadAppConfig;
function loadAppConfig(env = process.env) {
    const raw = (env.APP_ENV ?? '').trim();
    const appEnv = raw === 'staging' || raw === 'production' ? raw : null;
    // A real deployment must say what it is: a missing or misspelled marker stops the start (fail closed)
    if (env.NODE_ENV === 'production' && !appEnv) {
        throw new Error(`APP_ENV must be "staging" or "production" when NODE_ENV=production (found ${raw ? `"${raw}"` : 'nothing'}). Refusing to start.`);
    }
    // An unset or unknown value means strict, never the looser mode
    const scopeMode = (env.SCOPE_MODE ?? '').trim() === 'log' ? 'log' : 'strict';
    if (scopeMode === 'log' && appEnv !== 'staging') {
        throw new Error('SCOPE_MODE=log is only allowed with APP_ENV=staging. Refusing to start.');
    }
    return { appEnv, scopeMode };
}
//# sourceMappingURL=app-config.js.map