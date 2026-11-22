import { compare, hash } from 'bcryptjs';

/** Số vòng salt của bcrypt. Phải khớp hash của v1 (`users.service.ts`) để hai bên cùng kiểm được. */
export const BCRYPT_SALT_ROUNDS = 10;

/** Hash bất đồng bộ để không chặn event loop. */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(
  plain: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(plain, passwordHash);
}
