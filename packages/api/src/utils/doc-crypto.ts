// Seals the scanned-contract links in the document vault (AES-256-CBC, key = ENCRYPTION_KEY, exactly 32 bytes).
// There is no built-in key: in production without ENCRYPTION_KEY nothing can be saved or read (503). Development uses a fixed local key.
import crypto from 'crypto';
import { bad } from './input.js';

const key = (): Buffer => {
  const k = process.env.ENCRYPTION_KEY || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-documents-key-000000000');
  if (!k) throw bad('ENCRYPTION_KEY is not set on the server, so vault files cannot be saved or opened', 503);
  const b = Buffer.from(k);
  if (b.length !== 32) throw bad('ENCRYPTION_KEY must be exactly 32 bytes long', 503);
  return b;
};

export function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key(), iv);
  return iv.toString('hex') + ':' + Buffer.concat([cipher.update(text), cipher.final()]).toString('hex');
}

// A value without ":" is old plain text and is returned as it is; a value that cannot be opened (wrong key) comes back empty, never as cipher text
export function decrypt(text: string): string {
  if (!text) return text;
  if (!text.includes(':')) return text;
  const k = key();
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift() as string, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', k, iv);
    return Buffer.concat([decipher.update(Buffer.from(parts.join(':'), 'hex')), decipher.final()]).toString();
  } catch {
    console.error('Vault value could not be opened with ENCRYPTION_KEY');
    return '';
  }
}
