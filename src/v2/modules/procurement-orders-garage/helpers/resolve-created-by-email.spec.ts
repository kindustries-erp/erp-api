import { resolveCreatedByEmails } from './resolve-created-by-email';

describe('resolveCreatedByEmails', () => {
  it('không gọi truy vấn khi không có id nào', async () => {
    const users = { find: jest.fn() };
    const emails = await resolveCreatedByEmails(users as any, [
      null,
      undefined,
    ]);
    expect(users.find).not.toHaveBeenCalled();
    expect(emails.size).toBe(0);
  });

  it('gộp id trùng và trả map id → email trong một truy vấn', async () => {
    const users = {
      find: jest.fn().mockResolvedValue([{ id: 'u-1', email: 'a@liouni.com' }]),
    };
    const emails = await resolveCreatedByEmails(users as any, [
      'u-1',
      'u-1',
      null,
    ]);
    expect(users.find).toHaveBeenCalledTimes(1);
    expect(emails.get('u-1')).toBe('a@liouni.com');
    expect(emails.has('u-404')).toBe(false);
  });
});
