# Plan: Move the session token out of localStorage (finding F6)

Status: not started. This is a planned, separate piece of work. It follows the audit in `docs/LOGIN_SYSTEM.md`.

## 1. Problem

After sign in, the JWT is stored in `localStorage` under the key `rof-jwt`. Two weaknesses remain:

1. Any script running on the page can read it. A single cross-site scripting (XSS) bug anywhere in the CRM would let an attacker copy a user's token and use it for up to 8 hours (or until that user signs out, which now revokes it).
2. Letter, receipt and file pages are opened with the token in the address (`?token=...`). It can end up in browser history, proxy logs and server access logs. The server now accepts this form for GET requests only, which reduces but does not remove the exposure.

## 2. Goal

- The browser keeps the session in an `httpOnly` cookie that scripts cannot read.
- Page links and `window.open` calls no longer carry a token.
- No change in what users see, apart from a sign in that works the same way.

## 3. Current usage (measured on 2026-10-14)

| What | Count |
|---|---|
| Frontend files that read or use the token | 46 |
| Direct `localStorage.getItem('rof-jwt')` reads | 77 |
| `Authorization` header sites | 133 |
| `?token=` URL sites | 61, in 23 files |
| Files with the most `?token=` sites | `reports.js` 14, `receipts.js` 8, `demand-raise.js` 6, `allotment.js` 5 |
| Other token readers | `pcGetToken` in `pending-cheques.html`, `getToken()` in `custom-letters.html`, `token()` in `employee-login.html`, `_token()` in `cancel-addon-charge.js` |

Server side: one middleware (`authenticateToken`) is the only place that reads the token, and it already reads the user from the database.

There is no automated test suite for the frontend. Every page must be checked by hand in a browser.

## 4. Design

### 4.1 Cookie

- Name `rof_session`, value is the same JWT.
- Flags: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` outside development, `Max-Age` equal to the token lifetime (8 hours).
- Set by `POST /api/auth/login`. Cleared by `POST /api/auth/logout`.
- `authenticateToken` reads the token from, in order: `Authorization: Bearer`, then the cookie. The `?token=` form is removed at the end of the project (phase 5).

### 4.2 Protection against cross-site requests (CSRF)

Cookies are sent automatically, so a hostile site could try to trigger changes. Defences:

1. `SameSite=Lax` stops the cookie being sent on cross-site POST, PUT, PATCH and DELETE requests.
2. For any request that changes data and authenticates by cookie, require the header `X-Requested-With: rof-crm` (a plain form from another site cannot set it, and the existing CORS rules block other origins from sending it).
3. Keep the existing CORS allow list.

### 4.3 Frontend

- `Auth` becomes the only place that knows about sessions. It stops storing the token. `isAuthenticated()` and `getUser()` use a small profile (`id`, `name`, `email`, `role`, expiry time) returned by login and refreshed from `GET /api/users/me`, kept in memory or `sessionStorage`.
- `Api` sends `credentials: 'same-origin'` and the `X-Requested-With` header, and no longer builds an `Authorization` header.
- Every direct `fetch` with `Authorization: Bearer ...` (133 sites) either moves to `Api` or gets `credentials: 'same-origin'` plus the header.
- Every `?token=` link (61 sites) loses the parameter. Browser navigations send the cookie on their own.

## 5. Phases

Each phase ends with a full manual check and can be released alone.

| Phase | Work | Check |
|---|---|---|
| 0 | Write a manual test script listing every page and every print, download and letter action (about 40 pages). Record the current behaviour. | Script reviewed by the team. |
| 1 | Server: set and clear the cookie, accept the cookie in `authenticateToken`, add the CSRF header rule. Header tokens still work. No frontend change. | Login, logout, `curl` with cookie only, `curl` with header only, cross-site POST rejected. |
| 2 | Frontend core: `Auth`, `Api`, `permissions.js`, `login.html`. Keep a fallback that still sends the header, so nothing breaks half way. | Sign in, dashboard, permissions, logout. |
| 3 | Convert the 133 `Authorization` sites, one file per change, grouped by module (booking, payments, reports, transfers, setup). | The matching part of the manual script, for each file. |
| 4 | Remove the 61 `?token=` URLs (start with `reports.js`, `receipts.js`, `demand-raise.js`). | Open every letter, receipt, report and applicant file in a new tab. |
| 5 | Remove the header fallback, the `?token=` server path, and `localStorage` token code. Add `Content-Security-Policy` once inline scripts are reviewed (separate item). | Full manual script, plus a search that finds no `rof-jwt` left. |

## 6. Risks

| Risk | Mitigation |
|---|---|
| A page that still reads `localStorage` silently gets an empty token | Phase 2 keeps the old behaviour until phase 5. Search the code for `rof-jwt`, `getToken`, `pcGetToken`, `_token(` before each phase. |
| Cookie not sent on `fetch` | Always `credentials: 'same-origin'`. |
| `Secure` cookie not stored over plain http | Only enable `Secure` when `NODE_ENV` is not development. Render serves https. |
| CSRF header missing on one write call | Phase 1 logs the rejected request path first (warn only), then enforces in phase 5. |
| Print pages opened in a new window lose the session | Same origin, same cookie. Test every `window.open`. |
| Mobile or embedded browsers that block cookies | Confirm with the team which clients are used. |
| No staging database | Run every phase against a local database or a Neon branch, never against production data. |

## 7. Out of scope

- Moving away from JWT to server side sessions.
- Single sign on and two factor sign in.
- A Content Security Policy (listed as a follow up in phase 5).

## 8. Decisions needed before starting

1. Is the cookie approach approved, or should short lived (about 2 minute) print links be used instead and the main token stay in `localStorage`? The cookie approach is the stronger of the two and is the one described here.
2. Who tests each phase in a browser (the manual script in phase 0 needs a person with access to real workflows)?
3. Can phase 5 wait until phases 1 to 4 have run in production for a few days?
