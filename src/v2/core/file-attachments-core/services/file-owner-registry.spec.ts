import { FileOwnerRegistry } from './file-owner-registry';
import { FileOwnerType } from '../types/file-owner.types';
import type { FileOwnerPolicyPort } from '../contracts/file-owner-policy.port';

const policy = (ownerType: FileOwnerType): FileOwnerPolicyPort => ({
  ownerType,
  allowedCategories: () => ['KHAC'],
  assertExists: jest.fn(),
  assertCanModify: jest.fn(),
});

describe('FileOwnerRegistry', () => {
  it('đăng ký rồi tra cứu được', () => {
    const registry = new FileOwnerRegistry();
    const p = policy(FileOwnerType.INVOICE);
    registry.register(p);
    expect(registry.get('INVOICE')).toBe(p);
    expect(registry.has('INVOICE')).toBe(true);
    expect(registry.list()).toEqual(['INVOICE']);
  });

  it('owner chưa đăng ký thì báo lỗi rõ', () => {
    expect(() => new FileOwnerRegistry().get('INVOICE')).toThrow(
      /chưa được đăng ký/,
    );
  });

  it('đăng ký trùng owner thì báo lỗi', () => {
    const registry = new FileOwnerRegistry();
    registry.register(policy(FileOwnerType.INVOICE));
    expect(() => registry.register(policy(FileOwnerType.INVOICE))).toThrow(
      /đã được đăng ký/,
    );
  });
});
