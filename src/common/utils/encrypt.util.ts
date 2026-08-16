import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const PREFIX = 'enc:';

/**
 * Derives a deterministic 32-byte key from environment secret or fallback.
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.GDT_ENCRYPT_SECRET ||
    process.env.JWT_SECRET ||
    'liouni-erp-default-secret-key-32b';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plain text string using AES-256-CBC.
 * Returns format `enc:<iv_hex>:<cipher_hex>`.
 */
export function encryptText(plainText: string): string {
  if (!plainText) return plainText;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${PREFIX}${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-CBC encrypted string in format `enc:<iv_hex>:<cipher_hex>`.
 * Throws Error if format is invalid or decryption fails.
 */
export function decryptText(encryptedText: string): string {
  if (!encryptedText) return encryptedText;

  if (!encryptedText.startsWith(PREFIX)) {
    throw new Error('Invalid encrypted format');
  }

  const payload = encryptedText.slice(PREFIX.length);
  const colonIndex = payload.indexOf(':');
  if (colonIndex === -1) {
    throw new Error('Invalid encrypted payload format');
  }

  const ivHex = payload.slice(0, colonIndex);
  const cipherHex = payload.slice(colonIndex + 1);

  if (!ivHex || !cipherHex) {
    throw new Error('Missing IV or ciphertext');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Safely decrypts a string. If the string does not start with `enc:`,
 * it treats it as legacy plain text and returns it as-is.
 * If decryption fails, it logs/falls back to returning the raw string.
 */
export function safeDecrypt(text: string | null | undefined): string {
  if (!text) return '';
  if (!text.startsWith(PREFIX)) {
    return text;
  }
  try {
    return decryptText(text);
  } catch {
    return text;
  }
}
