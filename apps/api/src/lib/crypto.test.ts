import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../env.js', () => ({
  env: {
    // 32 bytes = 64 hex chars
    encryptionKey: 'a'.repeat(64),
  },
}));

import { encrypt, decrypt } from './crypto.js';

describe('crypto', () => {
  it('encrypts and decrypts a string roundtrip', () => {
    const plaintext = 'ghp_super_secret_token_12345';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':'); // iv:authTag:ciphertext format
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertexts for the same input (random IV)', () => {
    const plaintext = 'same-input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    parts[2] = Buffer.from('tampered').toString('base64');
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('handles empty string', () => {
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('handles unicode', () => {
    const plaintext = 'hello 🌍 世界';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });
});
