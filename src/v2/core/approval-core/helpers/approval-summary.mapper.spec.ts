import {
  toApprovalSummary,
  ApprovalHeaderLike,
} from './approval-summary.mapper';

const emails: Record<string, string> = {
  u1: 'nguoi.tao@x.vn',
  u2: 'nguoi.duyet@x.vn',
};
const emailOf = (id: string | null | undefined) =>
  id ? (emails[id] ?? null) : null;

const empty: ApprovalHeaderLike = {
  approverId: null,
  submittedBy: null,
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
  rejectedBy: null,
  rejectedAt: null,
  rejectReason: null,
  cancelledBy: null,
  cancelledAt: null,
  cancelReason: null,
  closedBy: null,
  closedAt: null,
  closeReason: null,
};

const at = new Date('2026-11-08T03:00:00Z');

describe('toApprovalSummary', () => {
  it('bước chưa xảy ra là null, không trả object rỗng', () => {
    const out = toApprovalSummary(empty, emailOf);
    expect(out).toEqual({
      approverId: null,
      approverEmail: null,
      submit: null,
      approve: null,
      reject: null,
      cancel: null,
      close: null,
      issue: null,
    });
  });

  it('đã duyệt: approverEmail là người duyệt, approve có by, byEmail, at', () => {
    const out = toApprovalSummary(
      {
        ...empty,
        approverId: 'u2',
        submittedBy: 'u1',
        submittedAt: at,
        approvedBy: 'u2',
        approvedAt: at,
      },
      emailOf,
    );
    expect(out.approverEmail).toBe('nguoi.duyet@x.vn');
    expect(out.submit).toEqual({ by: 'u1', byEmail: emails.u1, at });
    expect(out.approve).toEqual({ by: 'u2', byEmail: emails.u2, at });
    expect(out.approve).not.toHaveProperty('reason');
  });

  it('chưa duyệt: approverEmail lấy người được giao', () => {
    const out = toApprovalSummary(
      { ...empty, approverId: 'u2', submittedBy: 'u1', submittedAt: at },
      emailOf,
    );
    expect(out.approverEmail).toBe(emails.u2);
    expect(out.approve).toBeNull();
  });

  it('reject, cancel, close có reason và người thực hiện', () => {
    const out = toApprovalSummary(
      {
        ...empty,
        rejectedBy: 'u2',
        rejectedAt: at,
        rejectReason: 'Sai đơn giá',
        cancelledBy: 'u1',
        cancelledAt: at,
        cancelReason: 'Hủy nhu cầu',
        closedBy: 'u2',
        closedAt: at,
        closeReason: 'Đóng thiếu',
      },
      emailOf,
    );
    expect(out.reject).toEqual({
      by: 'u2',
      byEmail: emails.u2,
      at,
      reason: 'Sai đơn giá',
    });
    expect(out.cancel?.reason).toBe('Hủy nhu cầu');
    expect(out.close).toEqual({
      by: 'u2',
      byEmail: emails.u2,
      at,
      reason: 'Đóng thiếu',
    });
  });

  it('đóng tự động do đủ hàng: có at nhưng by và byEmail là null', () => {
    const out = toApprovalSummary(
      { ...empty, closedAt: at, closeReason: null },
      emailOf,
    );
    expect(out.close).toEqual({ by: null, byEmail: null, at, reason: null });
  });

  it('chế độ AUTO: submit tự duyệt cho ra cả submit và approve cùng người', () => {
    const out = toApprovalSummary(
      {
        ...empty,
        submittedBy: 'u1',
        submittedAt: at,
        approvedBy: 'u1',
        approvedAt: at,
      },
      emailOf,
    );
    expect(out.submit?.by).toBe('u1');
    expect(out.approve?.by).toBe('u1');
    expect(out.approverEmail).toBe(emails.u1);
  });

  it('issue chỉ có khi PO đã phát hành; PR (không có cột issue) trả null', () => {
    const po = toApprovalSummary(
      { ...empty, issuedBy: 'u1', issuedAt: at },
      emailOf,
    );
    expect(po.issue).toEqual({ by: 'u1', byEmail: emails.u1, at });
    expect(toApprovalSummary(empty, emailOf).issue).toBeNull();
  });
});
