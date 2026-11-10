import { resolveApprovalEmails } from './approval-people';

describe('resolveApprovalEmails', () => {
  it('gọi resolve đúng một lần cho cả lô, gom mọi user id', async () => {
    const resolve = jest.fn().mockResolvedValue(
      new Map([
        ['u1', { name: 'A', email: 'a@x.vn' }],
        ['u2', { name: 'B', email: 'b@x.vn' }],
      ]),
    );
    const emailOf = await resolveApprovalEmails({ resolve } as never, [
      { createdBy: 'u1', approverId: 'u2', approvedBy: 'u2' },
      { createdBy: 'u1', closedBy: null, rejectedBy: 'u9' },
    ]);

    expect(resolve).toHaveBeenCalledTimes(1);
    const ids = resolve.mock.calls[0][0] as unknown[];
    expect(ids).toEqual(expect.arrayContaining(['u1', 'u2', 'u9']));
    expect(emailOf('u1')).toBe('a@x.vn');
    expect(emailOf('u2')).toBe('b@x.vn');
  });

  it('id null, rỗng hoặc không tìm thấy trả null', async () => {
    const resolve = jest.fn().mockResolvedValue(new Map());
    const emailOf = await resolveApprovalEmails({ resolve } as never, [
      { createdBy: null },
    ]);
    expect(emailOf(null)).toBeNull();
    expect(emailOf(undefined)).toBeNull();
    expect(emailOf('')).toBeNull();
    expect(emailOf('không-có')).toBeNull();
  });
});
