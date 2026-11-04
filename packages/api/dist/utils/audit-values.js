"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pick = exports.withoutSecrets = void 0;
// Old and new values written to the audit log never carry secrets: passwords, hashes, tokens.
const SECRET_KEY = /^(password|currentpassword|confirmpassword|token|token_version)$|secret|_hash$|hash$|token$/i;
const withoutSecrets = (o) => {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
        if (SECRET_KEY.test(k))
            continue;
        out[k] = v && typeof v === 'object' && !Array.isArray(v) ? (0, exports.withoutSecrets)(v) : v;
    }
    return out;
};
exports.withoutSecrets = withoutSecrets;
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
exports.pick = pick;
//# sourceMappingURL=audit-values.js.map