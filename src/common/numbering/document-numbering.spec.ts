import { formatVnDateCompact, nextDocumentNo } from './document-numbering';

describe('document-numbering', () => {
  it('định dạng ngày theo múi giờ VN, không lệch sang ngày hôm trước', () => {
    // 2026-11-04 17:30 UTC là 2026-11-05 00:30 giờ VN
    expect(formatVnDateCompact(new Date('2026-11-04T17:30:00Z'))).toBe(
      '20261105',
    );
  });

  it('ngày không hợp lệ thì không ném lỗi', () => {
    expect(formatVnDateCompact('khong-phai-ngay')).toMatch(/^\d{8}$/);
  });

  it('số kế tiếp là 001 khi chưa có chứng từ, và tăng tiếp theo chuỗi có sẵn', async () => {
    const qb = (latest: { no: string } | undefined) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(latest),
    });
    const make = (latest?: { no: string }) => ({
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest
        .fn()
        .mockReturnValue({ createQueryBuilder: () => qb(latest) }),
    });

    const first = await nextDocumentNo(
      make() as never,
      class X {},
      'requestNo' as never,
      'DNM',
      new Date('2026-11-05T03:00:00Z'),
    );
    expect(first).toMatch(/^DNM-20261105-001$/);

    const next = await nextDocumentNo(
      make({ no: 'DNM-20261105-009' }) as never,
      class X {},
      'requestNo' as never,
      'DNM',
      new Date('2026-11-05T03:00:00Z'),
    );
    expect(next).toBe('DNM-20261105-010');
  });
});
