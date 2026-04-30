-- Migration 016: Rehash admin test user password with bcrypt
-- The seed/migration 015 set password_hash to base64('admin123') = 'YWRtaW4xMjM='
-- The login endpoint now auto-migrates base64 → bcrypt on first login,
-- but this migration pre-seeds the bcrypt hash so the test user works immediately.
-- Hash is bcrypt(cost=12) of 'admin123'

UPDATE users
SET password_hash = '$2a$12$XQrcmI1YY1NZuHJng5xR1u5CQ4IbELN2H0lrhEzhO87Taq3U4jJwy'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND (password_hash = 'YWRtaW4xMjM=' OR password_hash IS NULL);
