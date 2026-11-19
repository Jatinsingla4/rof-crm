# Link tokens in web addresses (QA-011)

Evidence: `packages/api/test/http-security.check.mjs` (run against a throwaway database; token values are never printed).

| Question | Answer (from `packages/api/src/index.ts`, `authenticateToken` and `/api/auth/link-token`) |
|---|---|
| Token type | A separate JWT, `purpose: "link"`, signed HS256 with the server secret. It is not the login token. |
| Claims | `userId`, `tv` (session version), `purpose`, `p` (the one path), `iat`, `exp`. No e-mail, name, role or permissions; the server loads those from the database on every request. |
| Scope | One path. `p` must equal the request path (query string excluded). The same token on any other page returns 401. |
| Lifetime | 60 seconds (`exp - iat`). It is not single use: it can be repeated for the same page until it expires. |
| Where it is accepted | Query string, GET only. A link token in the `Authorization` header is refused. |
| The login token in a URL | Refused (401). A login JWT is accepted only in the `Authorization` header. |
| Session binding and revocation | `tv` must equal the user's current `token_version`. Raising it (password change, forced sign-out, deactivation) invalidates the link token. The user record is cached for up to 15 seconds (`AUTH_CACHE_MS`), so revocation takes effect within 15 seconds. |
| Exposure | A link can sit in browser history and in proxy or access logs for its 60 seconds. After that it is useless. The page itself never contains a token (`buildEditScript` reads the login token from the browser's own storage). |
| Browser side | Pages write `?token=1` as a placeholder; `js/links.js` replaces it with a fresh link token when the link is opened. What a tester sees in the address bar is therefore a 60 second link token, not a login token. |

Open decisions for ROF (not changed here): single use links, binding a link to the requester's address, and whether to open the Applicant File with an authenticated fetch instead of a link (the Receipt Print already does).
