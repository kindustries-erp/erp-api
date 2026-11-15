import { hashSync, compareSync } from 'bcryptjs';
import { hashPassword, verifyPassword } from './password-hasher';

describe('password-hasher', () => {
  it('hash rồi verify đúng mật khẩu', async () => {
    const hashed = await hashPassword('Secret#1234');
    expect(hashed).not.toBe('Secret#1234');
    await expect(verifyPassword('Secret#1234', hashed)).resolves.toBe(true);
  });

  it('verify sai mật khẩu trả false', async () => {
    const hashed = await hashPassword('Secret#1234');
    await expect(verifyPassword('khac-nhau', hashed)).resolves.toBe(false);
  });

  it('tương thích hash đồng bộ của v1 (hai chiều)', async () => {
    expect(compareSync('Secret#1234', await hashPassword('Secret#1234'))).toBe(
      true,
    );
    await expect(
      verifyPassword('Secret#1234', hashSync('Secret#1234', 10)),
    ).resolves.toBe(true);
  });
});
