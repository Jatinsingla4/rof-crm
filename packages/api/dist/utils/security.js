"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intParam = exports.cleanIp = exports.passwordProblem = exports.cleanEmail = exports.isUuid = void 0;
// Small checks shared by the users and roles routes.
const node_net_1 = require("node:net");
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
exports.isUuid = isUuid;
// Returns the lowercase email, or null when it is not a usable address
const cleanEmail = (v) => {
    if (typeof v !== 'string')
        return null;
    const e = v.trim().toLowerCase();
    return e.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
};
exports.cleanEmail = cleanEmail;
// Returns the reason a password is not acceptable, or null. bcrypt only reads the first 72 bytes.
const passwordProblem = (p) => {
    if (typeof p !== 'string' || p.length < 8)
        return 'Password must be at least 8 characters';
    if (Buffer.byteLength(p) > 72)
        return 'Password must be at most 72 bytes';
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p))
        return 'Password must contain at least one letter and one number';
    return null;
};
exports.passwordProblem = passwordProblem;
// Returns the normalised IPv4 or IPv6 address, or null
const cleanIp = (v) => {
    if (typeof v !== 'string')
        return null;
    const ip = v.trim().replace(/^::ffff:/i, '');
    return (0, node_net_1.isIP)(ip) ? ip.toLowerCase() : null;
};
exports.cleanIp = cleanIp;
// Clamp a paging value coming from the query string to a whole number in [min, max]
const intParam = (v, dflt, min, max) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : dflt;
};
exports.intParam = intParam;
//# sourceMappingURL=security.js.map