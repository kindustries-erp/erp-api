import {
  assertCanDecide,
  resolveApprovalMode,
  resolveSubmitDecision,
} from './approval-gate.helper';

describe('approval-gate.helper', () => {
  describe('resolveApprovalMode', () => {
    it('không có dòng khóa thì là LEGACY (hành vi cũ)', () => {
      expect(resolveApprovalMode(null)).toBe('LEGACY');
    });

    it('khóa bật thì là REQUIRED, khóa tắt thì là AUTO', () => {
      expect(resolveApprovalMode({ approvalEnabled: true })).toBe('REQUIRED');
      expect(resolveApprovalMode({ approvalEnabled: false })).toBe('AUTO');
    });
  });

  describe('resolveSubmitDecision', () => {
    it('AUTO: tự duyệt, không cần người duyệt', () => {
      expect(resolveSubmitDecision('AUTO', 'u1', undefined)).toEqual({
        autoApprove: true,
        approverId: null,
      });
    });

    it('REQUIRED: thiếu người duyệt thì ném 400', () => {
      expect(() => resolveSubmitDecision('REQUIRED', 'u1', null)).toThrow(
        'Bắt buộc chọn người duyệt',
      );
    });

    it('REQUIRED: không cho chọn chính mình', () => {
      expect(() => resolveSubmitDecision('REQUIRED', 'u1', 'u1')).toThrow(
        'Không được chọn chính mình làm người duyệt',
      );
    });

    it('REQUIRED: chọn người khác thì chờ duyệt với approverId', () => {
      expect(resolveSubmitDecision('REQUIRED', 'u1', 'u2')).toEqual({
        autoApprove: false,
        approverId: 'u2',
      });
    });

    it('LEGACY: người duyệt tùy chọn, không có thì null', () => {
      expect(resolveSubmitDecision('LEGACY', 'u1', undefined)).toEqual({
        autoApprove: false,
        approverId: null,
      });
    });
  });

  describe('assertCanDecide', () => {
    it('không có người duyệt được chỉ định thì cho qua (theo quyền như cũ)', () => {
      expect(() => assertCanDecide(null, 'u1')).not.toThrow();
    });

    it('đúng người được chỉ định thì cho duyệt', () => {
      expect(() => assertCanDecide('u2', 'u2')).not.toThrow();
    });

    it('người khác bị chặn với 403', () => {
      expect(() => assertCanDecide('u2', 'u3')).toThrow(
        'Chỉ người duyệt được chỉ định mới được duyệt hoặc từ chối',
      );
    });
  });
});
