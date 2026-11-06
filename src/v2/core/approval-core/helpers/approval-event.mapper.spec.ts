import { toApprovalEventResponse } from './approval-event.mapper';

describe('toApprovalEventResponse', () => {
  it('chỉ lấy các trường hiển thị, copy mảng role', () => {
    const roles = ['MANAGER'];
    const out = toApprovalEventResponse({
      action: 'approve',
      fromStatus: 'PENDING_APPROVAL',
      toStatus: 'APPROVED',
      actorId: 'u2',
      actorRoles: roles,
      comment: null,
      createdAt: new Date('2026-11-05T00:00:00Z'),
    });
    roles.push('X');
    expect(out).toEqual({
      action: 'approve',
      fromStatus: 'PENDING_APPROVAL',
      toStatus: 'APPROVED',
      actorId: 'u2',
      actorRoles: ['MANAGER'],
      comment: null,
      createdAt: new Date('2026-11-05T00:00:00Z'),
    });
  });
});
