# Mail server settings (smtp-configs)

Route: `packages/api/src/routes/smtp_config.ts`. Screen: Communication Setup (`collection-setup.js`). Tests: `api-test-smtp.mjs` (82 checks), `e2e/smtp.spec.ts` (5 tests).

## What was wrong
1. `GET` returned `s.*`, so the stored (encrypted) mail password went to every browser that opened the list.
2. A built-in fallback key (`rof-crm-secure-key-32-chars-long!!`) sealed the password, so anyone with the repo could decrypt it; a key of the wrong length gave a 500.
3. No validation at all: host, port, sender, cc/bcc were stored as sent (a 500 on a bad port, header injection through cc/bcc or sender name).
4. Accounts could change the mail credentials; no audit entry; the screen pasted project name and host into HTML unescaped; the sender email was taken from the username.

## Decisions
- Only a **super admin** can save; accounts can list (no password). The screen itself is closed to accounts by the web guard.
- Password sealed with AES-256-GCM, key = SHA-256 of `SMTP_SECRET`. **No built-in key**: in production without `SMTP_SECRET` a password cannot be saved (503 with the reason). Development uses a fixed local key.
- The API only says `has_password`. A blank password on update keeps the old one; a new project needs one.
- Host must be a server name; localhost, private ranges, `.internal`, `.local` and the cloud metadata address are refused (the server will connect to it later).
- Port 1-65535, sender email required and valid, cc/bcc up to 10 valid addresses (lower-cased, de-duplicated), no line breaks in any field. Audit log never holds the password.
- Old rows sealed with the public key have format `abc:def` and cannot be opened by `openSealed`; save the password again (nothing read them before, there is no sender yet).

## Not done
- No test-send button and no sender reads these rows (email worker still uses the `SMTP_*` environment): product decision.
- **Owner chore:** set `SMTP_SECRET` on Vercel (any long random text) and re-save each project's password.
