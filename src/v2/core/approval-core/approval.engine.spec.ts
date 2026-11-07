import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  assertNotSelfApproval,
  requireReason,
  resolveTransition,
} from './approval.engine';

const rules = {
  submit: { from: ['DRAFT'], to: 'PENDING_APPROVAL' },
  approve: { from: ['PENDING_APPROVAL'], to: 'APPROVED' },
} as const;

describe('approval.engine', () => {
  it('resolveTransition trả về trạng thái đích khi hợp lệ', () => {
    expect(resolveTransition(rules, 'DRAFT', 'submit')).toBe(
      'PENDING_APPROVAL',
    );
  });

  it('resolveTransition ném 409 khi trạng thái không cho phép hành động', () => {
    expect(() => resolveTransition(rules, 'APPROVED', 'submit')).toThrow(
      ConflictException,
    );
  });

  it('resolveTransition ném 400 khi hành động không có luật', () => {
    expect(() => resolveTransition(rules, 'DRAFT', 'issue' as never)).toThrow(
      BadRequestException,
    );
  });

  it('assertNotSelfApproval chặn người tạo tự duyệt', () => {
    expect(() => assertNotSelfApproval('u1', 'u1')).toThrow(ForbiddenException);
  });

  it('assertNotSelfApproval cho phép khi người duyệt khác người tạo hoặc không rõ người tạo', () => {
    expect(() => assertNotSelfApproval('u2', 'u1')).not.toThrow();
    expect(() => assertNotSelfApproval('u2', null)).not.toThrow();
  });

  it('requireReason chặn lý do rỗng hoặc chỉ có khoảng trắng và trả về bản đã cắt', () => {
    expect(() => requireReason('   ')).toThrow(BadRequestException);
    expect(() => requireReason(undefined)).toThrow(BadRequestException);
    expect(requireReason('  thiếu hồ sơ  ')).toBe('thiếu hồ sơ');
  });
});
