import {
  KgaraCostEnricherHelper,
  type JournalItemCost,
} from './kgara-cost-enricher.helper';

describe('KgaraCostEnricherHelper', () => {
  describe('cleanName', () => {
    it('should strip vehicle plates and brackets', () => {
      expect(
        KgaraCostEnricherHelper.cleanName(
          '[51M80574] - [Nhớt động cơ 5W-30 Mercedes-Benz]',
        ),
      ).toBe('nhớt động cơ 5w-30 mercedes-benz');
      expect(KgaraCostEnricherHelper.cleanName('[Lọc nhớt Nissan]')).toBe(
        'lọc nhớt nissan',
      );
      expect(KgaraCostEnricherHelper.cleanName('  PISTON  ')).toBe('piston');
      expect(KgaraCostEnricherHelper.cleanName(null)).toBe('');
    });
  });

  describe('enrichCaseLines with GR-PDV2609-0056 payload', () => {
    const mockLines: any[] = [
      {
        LoaiSanPhamCode: 'DV',
        SanPhamName: 'Công bảo dưỡng',
        SoLuongHoaDon: 1,
        DonGia: 400000,
        GiaVonPhuTung: 0,
      },
      {
        LoaiSanPhamCode: 'PT',
        SanPhamName: 'Nhớt động cơ 5W-30 Mercedes-Benz',
        SoLuongHoaDon: 6,
        DonGia: 220000,
        GiaVonPhuTung: 0,
      },
      {
        LoaiSanPhamCode: 'PT',
        SanPhamName: 'Lọc nhớt Nissan',
        SoLuongHoaDon: 1,
        DonGia: 180000,
        GiaVonPhuTung: 0,
      },
      {
        LoaiSanPhamCode: 'PT',
        SanPhamName: 'Dung dịch nước rửa kính',
        SoLuongHoaDon: 1,
        DonGia: 75000,
        GiaVonPhuTung: 0,
      },
      {
        LoaiSanPhamCode: 'PT',
        SanPhamName: 'Chai vệ sinh thắng',
        SoLuongHoaDon: 1,
        DonGia: 150000,
        GiaVonPhuTung: 0,
      },
    ];

    const mockJournalItems: JournalItemCost[] = [
      {
        TaiKhoanNoCode: '131',
        TaiKhoanCoCode: '5113',
        GiaTriTien: 400000,
        ChiPhi: 0,
        NoiDung: 'Doanh thu [51M80574] Công bảo dưỡng',
      },
      {
        TaiKhoanNoCode: '1541',
        TaiKhoanCoCode: '152',
        GiaTriTien: 1140000,
        ChiPhi: 1140000,
        NoiDung: '[51M80574] - [Nhớt động cơ 5W-30 Mercedes-Benz]',
      },
      {
        TaiKhoanNoCode: '1541',
        TaiKhoanCoCode: '152',
        GiaTriTien: 180000,
        ChiPhi: 180000,
        NoiDung: '[51M80574] - [Lọc nhớt Nissan]',
      },
      {
        TaiKhoanNoCode: '1541',
        TaiKhoanCoCode: '152',
        GiaTriTien: 65000,
        ChiPhi: 65000,
        NoiDung: '[51M80574] - [Chai vệ sinh thắng]',
      },
      {
        TaiKhoanNoCode: '1541',
        TaiKhoanCoCode: '152',
        GiaTriTien: 30000,
        ChiPhi: 30000,
        NoiDung: '[51M80574] - [Dung dịch nước rửa kính]',
      },
    ];

    it('should accurately enrich unit cost and total cost for all parts', () => {
      const result = KgaraCostEnricherHelper.enrichCaseLines(
        mockLines,
        mockJournalItems,
      );

      expect(result.hasEnrichedCosts).toBe(true);
      expect(result.costBreakdown.warehousePartsCost).toBe(1415000);
      expect(result.costBreakdown.allocatedPartsCost).toBe(1415000);
      expect(result.costBreakdown.unallocatedCost).toBe(0);

      // Dịch vụ (DV) không bị gán giá vốn PT
      expect(result.lines[0].GiaVonPhuTung).toBe(0);

      // Nhớt: 1.140.000 / 6 = 190.000
      expect(result.lines[1].GiaVonPhuTung).toBe(190000);
      expect(result.lines[1].TongVon).toBe(1140000);
      expect(result.lines[1].CostAllocationType).toBe('WAREHOUSE_ISSUE');

      // Lọc nhớt: 180.000 / 1 = 180.000
      expect(result.lines[2].GiaVonPhuTung).toBe(180000);
      expect(result.lines[2].TongVon).toBe(180000);

      // Nước rửa kính: 30.000
      expect(result.lines[3].GiaVonPhuTung).toBe(30000);

      // Chai vệ sinh thắng: 65.000
      expect(result.lines[4].GiaVonPhuTung).toBe(65000);
    });
  });

  describe('enrichCaseLines with external purchases (GR-PDV2609-0074 style)', () => {
    const mockLines: any[] = [
      {
        LoaiSanPhamCode: 'PT',
        SanPhamName: 'PISTON',
        SoLuongHoaDon: 4,
        DonGia: 2075000,
        GiaVonPhuTung: 0,
      },
    ];

    const mockJournalItems: JournalItemCost[] = [
      {
        TaiKhoanNoCode: '1542',
        TaiKhoanCoCode: '331',
        GiaTriTien: 45150000,
        ChiPhi: 45150000,
        NoiDung: 'Thuê gia công Mua phụ tùng [70LD00642] Công tháo lắp động cơ',
      },
      {
        TaiKhoanNoCode: '1543',
        TaiKhoanCoCode: '335',
        GiaTriTien: 7099900,
        ChiPhi: 7099900,
        NoiDung: 'Hoa hồng môi giới [70LD00642]',
      },
    ];

    it('should summarize external and commission costs even if parts are unallocated', () => {
      const result = KgaraCostEnricherHelper.enrichCaseLines(
        mockLines,
        mockJournalItems,
      );

      expect(result.costBreakdown.externalCost).toBe(45150000);
      expect(result.costBreakdown.commissionCost).toBe(7099900);
      expect(result.costBreakdown.totalCost).toBe(52249900);
      expect(result.costBreakdown.allocatedPartsCost).toBe(0);
      expect(result.costBreakdown.unallocatedCost).toBe(52249900);

      // Piston chưa có giá vốn xuất kho riêng
      expect(result.lines[0].GiaVonPhuTung).toBe(0);
    });
  });
});

describe('KgaraCostEnricherHelper manual cost & stale helpers', () => {
  const journal = [
    {
      TaiKhoanNoCode: '1541',
      GiaTriTien: 380000,
      ChiPhi: 380000,
      NoiDung: '[51M80574] - [Nhớt động cơ 5W-30]',
    },
    { TaiKhoanNoCode: '1542', GiaTriTien: 50000, ChiPhi: 50000 },
  ];

  it('sumWarehouseCost chỉ cộng TK 1541', () => {
    expect(KgaraCostEnricherHelper.sumWarehouseCost(journal)).toBe(380000);
    expect(KgaraCostEnricherHelper.sumWarehouseCost(null)).toBe(0);
  });

  it('enrichCaseLines không ghi đè dòng nhập tay MANUAL_ERP', () => {
    const lines = [
      {
        LoaiSanPhamCode: 'PT',
        SanPhamName: 'Nhớt động cơ 5W-30',
        SoLuongHoaDon: 2,
        GiaVonPhuTung: 999,
        TongVon: 1998,
        CostAllocationType: 'MANUAL_ERP',
      },
    ];

    const res = KgaraCostEnricherHelper.enrichCaseLines(lines, journal);

    expect(res.lines[0].GiaVonPhuTung).toBe(999);
    expect(res.lines[0].TongVon).toBe(1998);
    expect(res.lines[0].CostAllocationType).toBe('MANUAL_ERP');
  });

  it('carryOverManualLines mang giá vốn nhập tay sang payload mới theo id', () => {
    const prev = [
      {
        HdPhieuDichVuChiTietID: 'L1',
        GiaVonPhuTung: 700,
        TongVon: 1400,
        CostAllocationType: 'MANUAL_ERP',
      },
      { HdPhieuDichVuChiTietID: 'L2', GiaVonPhuTung: 5 },
    ];
    const next: any[] = [
      { HdPhieuDichVuChiTietID: 'L1', GiaVonPhuTung: 0 },
      { HdPhieuDichVuChiTietID: 'L2', GiaVonPhuTung: 0 },
    ];

    KgaraCostEnricherHelper.carryOverManualLines(prev, next);

    expect(next[0]).toMatchObject({
      GiaVonPhuTung: 700,
      TongVon: 1400,
      CostAllocationType: 'MANUAL_ERP',
    });
    expect(next[1].GiaVonPhuTung).toBe(0);
  });
});
