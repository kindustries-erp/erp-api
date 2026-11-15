import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  assertApproverOnlyDecides,
  assertCreatorOnly,
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

  it('resolveTransition ném 409 kèm code INVALID_STATUS_TRANSITION và trạng thái hiện tại', () => {
    try {
      resolveTransition(rules, 'APPROVED', 'approve');
      fail('expected ConflictException');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
        action: 'approve',
        currentStatus: 'APPROVED',
      });
    }
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

  it('assertCreatorOnly ném 403 kèm thông báo khi người thao tác không phải người tạo', () => {
    expect(() => assertCreatorOnly('u2', 'u1', 'hủy')).toThrow(
      new ForbiddenException('Chỉ người tạo mới được hủy'),
    );
  });

  it('assertCreatorOnly cho qua khi người thao tác là người tạo', () => {
    expect(() => assertCreatorOnly('u1', 'u1', 'hủy')).not.toThrow();
  });

  it('assertCreatorOnly cho qua khi chứng từ không có người tạo (null)', () => {
    expect(() => assertCreatorOnly('u2', null, 'xóa')).not.toThrow();
  });

  it('assertApproverOnlyDecides cho người duyệt chỉ định duyệt và từ chối', () => {
    const doc = { approverId: 'boss', createdBy: 'staff' };
    expect(() =>
      assertApproverOnlyDecides('boss', doc, 'approve'),
    ).not.toThrow();
    expect(() =>
      assertApproverOnlyDecides('boss', doc, 'reject'),
    ).not.toThrow();
  });

  it('assertApproverOnlyDecides chặn người duyệt chỉ định làm hành động khác', () => {
    const doc = { approverId: 'boss', createdBy: 'staff' };
    for (const action of ['cancel', 'recall', 'issue', 'close', 'submit']) {
      expect(() => assertApproverOnlyDecides('boss', doc, action)).toThrow(
        new ForbiddenException(
          'Người duyệt chỉ được duyệt hoặc từ chối chứng từ của người tạo',
        ),
      );
    }
  });

  it('assertApproverOnlyDecides không chặn người khác, người tạo, hoặc chứng từ chưa có người duyệt', () => {
    expect(() =>
      assertApproverOnlyDecides(
        'other',
        { approverId: 'boss', createdBy: 'staff' },
        'cancel',
      ),
    ).not.toThrow();
    expect(() =>
      assertApproverOnlyDecides(
        'staff',
        { approverId: 'staff', createdBy: 'staff' },
        'cancel',
      ),
    ).not.toThrow();
    expect(() =>
      assertApproverOnlyDecides(
        'boss',
        { approverId: null, createdBy: 'staff' },
        'cancel',
      ),
    ).not.toThrow();
  });

  it('requireReason chặn lý do rỗng hoặc chỉ có khoảng trắng và trả về bản đã cắt', () => {
    expect(() => requireReason('   ')).toThrow(BadRequestException);
    expect(() => requireReason(undefined)).toThrow(BadRequestException);
    expect(requireReason('  thiếu hồ sơ  ')).toBe('thiếu hồ sơ');
  });
});
