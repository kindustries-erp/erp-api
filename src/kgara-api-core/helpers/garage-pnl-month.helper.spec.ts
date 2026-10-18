import {
  bucketOpex,
  monthLabel,
  monthWindow,
  reportMonthOf,
  toPnlMonthRow,
  toPnlTrendPoint,
} from './garage-pnl-month.helper';

describe('garage-pnl-month.helper', () => {
  const today = new Date(2026, 9, 16); // 16/10/2026

  describe('reportMonthOf', () => {
    it('lấy tháng chứa ngày kết thúc kỳ', () => {
      expect(reportMonthOf('2026-09-30', today)).toEqual({
        year: 2026,
        month: 9,
      });
      expect(reportMonthOf('2026-08-15T10:00:00', today)).toEqual({
        year: 2026,
        month: 8,
      });
    });

    it('không vượt tháng hiện tại (Quý 4 kết thúc 31/12 thì dùng tháng 10)', () => {
      expect(reportMonthOf('2026-12-31', today)).toEqual({
        year: 2026,
        month: 10,
      });
      expect(reportMonthOf('2027-01-01', today)).toEqual({
        year: 2026,
        month: 10,
      });
    });

    it('thiếu hoặc sai định dạng thì dùng tháng hiện tại', () => {
      expect(reportMonthOf(undefined, today)).toEqual({
        year: 2026,
        month: 10,
      });
      expect(reportMonthOf('abc', today)).toEqual({ year: 2026, month: 10 });
      expect(reportMonthOf('2026-13-01', today)).toEqual({
        year: 2026,
        month: 10,
      });
    });
  });

  describe('monthWindow', () => {
    it('12 tháng kết thúc ở tháng báo cáo, từ cũ đến mới, vắt qua năm', () => {
      const window = monthWindow({ year: 2026, month: 7 }, 12);
      expect(window).toHaveLength(12);
      expect(window[0]).toEqual({ year: 2025, month: 8 });
      expect(window[11]).toEqual({ year: 2026, month: 7 });
      expect(window.map(monthLabel).slice(0, 2)).toEqual([
        '2025-thg 8',
        '2025-thg 9',
      ]);
    });

    it('tháng 1 lùi về tháng 12 năm trước', () => {
      expect(monthWindow({ year: 2026, month: 1 }, 2)).toEqual([
        { year: 2025, month: 12 },
        { year: 2026, month: 1 },
      ]);
    });
  });

  describe('bucketOpex', () => {
    it('gom theo khóa và theo tên, khóa lạ vào Khác, tổng luôn khớp', () => {
      const items = [
        { categoryKey: 'NHAN_SU', categoryName: 'Nhân sự', amount: 76500000 },
        {
          categoryKey: 'THUE_MAT_BANG',
          categoryName: 'Thuê mặt bằng & điện nước',
          amount: 30000000,
        },
        {
          categoryKey: 'VAT_TU_TIEU_HAO',
          categoryName: 'Vật tư tiêu hao',
          amount: 15000000,
        },
        { categoryKey: 'X1', categoryName: 'Vật tư văn phòng', amount: 1000 },
        { categoryKey: 'BAO_TRI', categoryName: 'Bảo trì', amount: 10000000 },
        {
          categoryKey: 'KHAU_HAO',
          categoryName: 'Khấu hao máy móc & thiết bị',
          amount: 15000000,
        },
        { categoryKey: 'KHAC', categoryName: 'Khác', amount: 500 },
      ];
      const b = bucketOpex(items);
      expect(b).toEqual({
        nhanSu: 76500000,
        matBang: 30000000,
        vatTu: 15001000,
        baoTri: 10000000,
        khauHao: 15000000,
        khac: 500,
      });
      expect(Object.values(b).reduce((a, v) => a + v, 0)).toBe(
        items.reduce((a, i) => a + i.amount, 0),
      );
    });

    it('danh sách rỗng cho toàn 0', () => {
      expect(Object.values(bucketOpex([])).every((v) => v === 0)).toBe(true);
    });
  });

  describe('toPnlMonthRow', () => {
    it('rút gọn báo cáo P&L và ép số', () => {
      const row = toPnlMonthRow(
        { year: 2026, month: 7 },
        {
          revenue: '444218804',
          cogs: 241508218,
          grossProfit: 202710586,
          grossMarginRate: 45.63,
          opex: {
            total: 146500000,
            items: [
              {
                categoryKey: 'NHAN_SU',
                categoryName: 'Nhân sự',
                amount: '76500000',
              },
            ],
          },
          netProfitBeforeCommission: 56210586,
          commission: {
            total: 5621059,
            items: [
              {
                categoryKey: 'HOA_HONG_DV',
                categoryName: 'Hoa hồng cho DV (10%)',
                amount: 5621059,
              },
            ],
          },
          netProfitAfterCommission: 50589527,
        },
      );
      expect(row).toMatchObject({
        year: 2026,
        month: 7,
        revenue: 444218804,
        cogs: 241508218,
        opexTotal: 146500000,
        netBeforeCommission: 56210586,
        commissionTotal: 5621059,
        netAfterCommission: 50589527,
      });
      expect(row.opexItems[0].amount).toBe(76500000);
      expect(row.commissionItems[0].categoryKey).toBe('HOA_HONG_DV');
    });

    it('báo cáo rỗng cho dòng toàn 0 và mảng rỗng', () => {
      const row = toPnlMonthRow({ year: 2026, month: 1 }, undefined);
      expect(row.revenue).toBe(0);
      expect(row.opexItems).toEqual([]);
      expect(row.commissionItems).toEqual([]);
      expect(row.cogsAdjustmentItems).toEqual([]);
      expect(row.revenueSegments).toEqual([]);
      expect(row.cogsDirect).toBe(0);
      expect(row.hhbhTotal).toBe(0);
    });

    it('lấy phân loại doanh thu, điều chỉnh giá vốn, HHBH và ghi chú dòng nhập', () => {
      const row = toPnlMonthRow(
        { year: 2026, month: 10 },
        {
          revenue: 1000,
          cogs: 700,
          cogsDirect: 600,
          cogsAdjustment: {
            total: 100,
            items: [
              {
                categoryKey: 'VAT_TU_TIEU_HAO',
                categoryName: 'Vật tư tiêu hao',
                amount: '100',
                note: '  Dầu nhớt xưởng  ',
              },
            ],
          },
          revenueByClassification: [
            {
              key: 'OJ',
              label: 'OJ',
              caseCount: '2',
              revenue: '400',
              cogs: '300',
            },
          ],
          opex: {
            total: 50,
            items: [
              {
                categoryKey: 'NHAN_SU',
                categoryName: 'Nhân sự',
                amount: 50,
                note: '   ',
              },
            ],
          },
          sellingExpenses: {
            total: 80,
            items: [
              { categoryKey: 'RATE_X', amount: 5 },
              { categoryKey: 'HHBH', categoryName: 'HHBH', amount: '30' },
            ],
          },
        },
      );

      expect(row.cogsDirect).toBe(600);
      expect(row.cogsAdjustmentItems).toEqual([
        {
          categoryKey: 'VAT_TU_TIEU_HAO',
          categoryName: 'Vật tư tiêu hao',
          amount: 100,
          note: 'Dầu nhớt xưởng',
        },
      ]);
      expect(row.revenueSegments).toEqual([
        { key: 'OJ', label: 'OJ', caseCount: 2, revenue: 400, cogs: 300 },
      ]);
      expect(row.hhbhTotal).toBe(30);
      // ghi chú trống bị bỏ, không để chuỗi rỗng
      expect('note' in row.opexItems[0]).toBe(false);
    });
  });
  describe('toPnlTrendPoint', () => {
    const row = toPnlMonthRow(
      { year: 2026, month: 7 },
      {
        revenue: 1000,
        cogs: 570,
        grossProfit: 430,
        opex: {
          total: 300,
          items: [
            { categoryKey: 'NHAN_SU', categoryName: 'Nhân sự', amount: 110 },
            { categoryKey: 'BAO_TRI', categoryName: 'Bảo trì', amount: 40 },
            { categoryKey: 'LA', categoryName: 'Lạ', amount: 150 },
          ],
        },
      },
    );

    it('tính tỷ trọng trên doanh thu và nhãn tháng', () => {
      const p = toPnlTrendPoint(row);
      expect(p.label).toBe('2026-thg 7');
      expect(p.grossMarginRatio).toBeCloseTo(0.43);
      expect(p.ratios.cogs).toBeCloseTo(0.57);
      expect(p.ratios.nhanSu).toBeCloseTo(0.11);
      expect(p.ratios.baoTri).toBeCloseTo(0.04);
      expect(p.ratios.khac).toBeCloseTo(0.15);
    });

    it('doanh thu 0: ratios = 0 và grossMarginRatio = null', () => {
      const p = toPnlTrendPoint({ ...row, revenue: 0 });
      expect(p.grossMarginRatio).toBeNull();
      expect(Object.values(p.ratios).every((v) => v === 0)).toBe(true);
    });
  });
});
