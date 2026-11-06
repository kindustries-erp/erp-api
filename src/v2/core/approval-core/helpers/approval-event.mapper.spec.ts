import { toApprovalEventResponse } from './approval-event.mapper';

const base = {
  action: 'approve',
  fromStatus: 'PENDING_APPROVAL',
  toStatus: 'APPROVED',
  actorId: 'u2',
  actorRoles: ['MANAGER'],
  comment: null,
  createdAt: new Date('2026-11-05T00:00:00Z'),
};

describe('toApprovalEventResponse', () => {
  it('không có actor thì tên và email là null, copy mảng role', () => {
    const roles = ['MANAGER'];
    const out = toApprovalEventResponse({ ...base, actorRoles: roles });
    roles.push('X');
    expect(out).toEqual({
      action: 'approve',
      fromStatus: 'PENDING_APPROVAL',
      toStatus: 'APPROVED',
      actorId: 'u2',
      actorName: null,
      actorEmail: null,
      actorRoles: ['MANAGER'],
      comment: null,
      createdAt: new Date('2026-11-05T00:00:00Z'),
    });
  });

  it('có actor thì gắn họ tên và email', () => {
    const out = toApprovalEventResponse(base, {
      name: 'Nguyễn Văn A',
      email: 'a@x.vn',
    });
    expect(out.actorName).toBe('Nguyễn Văn A');
    expect(out.actorEmail).toBe('a@x.vn');
  });

  it('actor không có họ tên (chưa gắn nhân viên) thì tên null, email vẫn có', () => {
    const out = toApprovalEventResponse(base, { name: null, email: 'b@x.vn' });
    expect(out.actorName).toBeNull();
    expect(out.actorEmail).toBe('b@x.vn');
  });

  it('không trả id nội bộ của nhật ký', () => {
    const out = toApprovalEventResponse({ ...base, comment: 'Đồng ý' });
    expect(out).not.toHaveProperty('id');
    expect(out.comment).toBe('Đồng ý');
  });
});
