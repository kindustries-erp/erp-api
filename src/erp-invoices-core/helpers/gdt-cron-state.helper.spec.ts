import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { GdtCronStateHelper } from './gdt-cron-state.helper';

describe('GdtCronStateHelper', () => {
  beforeEach(() => {
    GdtCronStateHelper.resetStateForTest();
  });

  afterEach(() => {
    GdtCronStateHelper.resetStateForTest();
  });

  it('bắt đầu ở trạng thái không tạm dừng', () => {
    expect(GdtCronStateHelper.isPaused()).toBe(false);
  });

  it('pauseDueToAuthError bật cờ tạm dừng (zero-lockout)', () => {
    GdtCronStateHelper.pauseDueToAuthError();
    expect(GdtCronStateHelper.isPaused()).toBe(true);
  });

  it('resume tắt cờ, xóa mốc slot đã chạy và gọi callback đăng ký', () => {
    const onResume = jest.fn();
    GdtCronStateHelper.onResume(onResume);
    GdtCronStateHelper.pauseDueToAuthError();
    GdtCronStateHelper.setLastExecutedSlotKey('2026-10-29-09:15');

    GdtCronStateHelper.resume();

    expect(GdtCronStateHelper.isPaused()).toBe(false);
    expect(GdtCronStateHelper.getLastExecutedSlotKey()).toBeNull();
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('một callback lỗi không chặn các callback còn lại', () => {
    const failing = jest.fn(() => {
      throw new Error('boom');
    });
    const healthy = jest.fn();
    GdtCronStateHelper.onResume(failing);
    GdtCronStateHelper.onResume(healthy);

    expect(() => GdtCronStateHelper.resume()).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it('lưu và đọc mốc slot đã chạy', () => {
    GdtCronStateHelper.setLastExecutedSlotKey('slot-A');
    expect(GdtCronStateHelper.getLastExecutedSlotKey()).toBe('slot-A');
    GdtCronStateHelper.setLastExecutedSlotKey(null);
    expect(GdtCronStateHelper.getLastExecutedSlotKey()).toBeNull();
  });
});
