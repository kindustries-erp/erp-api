import { PurchaseOrderNumberingService } from './purchase-order-numbering.service';

describe('PurchaseOrderNumberingService', () => {
  const service = new PurchaseOrderNumberingService();

  const buildManager = (latestPoNo: string | null) => {
    const getOne = jest
      .fn()
      .mockResolvedValue(latestPoNo ? { poNo: latestPoNo } : null);
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne,
    };
    const query = jest.fn().mockResolvedValue([]);
    const manager = {
      query,
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      }),
    };
    return { manager, query, qb };
  };

  describe('formatVnDate (giờ Việt Nam)', () => {
    it('lấy đúng ngày theo chuỗi YYYY-MM-DD', () => {
      expect(service.formatVnDate('2026-11-04')).toBe('20261104');
    });

    it('ngày 23:30 UTC ngày 3 là ngày 4 theo giờ VN (+07)', () => {
      expect(service.formatVnDate('2026-11-03T23:30:00.000Z')).toBe('20261104');
    });

    it('ngày không hợp lệ không sinh NaN, dùng ngày hiện tại (#9)', () => {
      const result = service.formatVnDate('abc');
      expect(result).toMatch(/^\d{8}$/);
      expect(result).not.toContain('NaN');
    });
  });

  describe('nextNo', () => {
    it('lấy khóa advisory trước khi đọc số lớn nhất', async () => {
      const { manager, query } = buildManager(null);
      await service.nextNo(manager as any, {} as any, 'PO', '2026-11-04');
      expect(query).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        ['PO-20261104-'],
      );
    });

    it('trả 001 khi chưa có PO trong ngày', async () => {
      const { manager } = buildManager(null);
      const no = await service.nextNo(
        manager as any,
        {} as any,
        'PO',
        '2026-11-04',
      );
      expect(no).toBe('PO-20261104-001');
    });

    it('tăng tiếp số lớn nhất trong ngày', async () => {
      const { manager, qb } = buildManager('PO-20261104-007');
      const no = await service.nextNo(
        manager as any,
        {} as any,
        'PO',
        '2026-11-04',
      );
      expect(no).toBe('PO-20261104-008');
      expect(qb.where).toHaveBeenCalledWith('po.poNo LIKE :prefix', {
        prefix: 'PO-20261104-%',
      });
    });

    it('không sinh NaN khi số cuối không phải số', async () => {
      const { manager } = buildManager('PO-20261104-XYZ');
      const no = await service.nextNo(
        manager as any,
        {} as any,
        'PO',
        '2026-11-04',
      );
      expect(no).toBe('PO-20261104-001');
    });
  });
});
