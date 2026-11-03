import {
  KgaraCaseFinancialParserHelper,
  resolveCaseVatAmount,
} from './kgara-case-financial-parser.helper';

describe('KgaraCaseFinancialParserHelper', () => {
  const mockPayloadGrPdv2606_0025 = {
    TenKhachHang: 'PHAN NGUYỄN TỊNH VŨ',
    BienSoXe: '51M78894',
    TenLaiXe: 'Nguyễn Văn Tài',
    SoChungTu: 'GR-PDV2606-0025',
    TienChuaThue: 1500000,
    TongTienHang: 1275000,
    TienChietKhau: 225000,
    TyLeChietKhau: 15,
    TienKhauTruBaoHiem: 500000,
    TienChiPhiCheTai: 0,
    TienSauCheTai: 775000,
    TienThue: 102000,
    ThueSuat: 8,
    TienThanhToanKH: 540000,
    TienThanhToanBH: 837000,
    TongTienThanhToan: 1377000,
    TienHoaHong: 0,
    TienHoaHongBaoHiem: 200000,
    TyLeHoaHongBaoHiem: 0,
    GiamDinhVienName: 'GĐV Bảo Việt',
    TienHoaHongMoiGioi: 0,
    TyLeHoaHongMoiGioi: 0,
    NguoiMoiGioiName: null,
    XeLamBaoHiem: true,
  };

  describe('parseFinancialSummary', () => {
    it('should parse financial parameters matching real quote GR-PDV2606-0025 accurately', () => {
      const summary = KgaraCaseFinancialParserHelper.parseFinancialSummary(
        mockPayloadGrPdv2606_0025,
      );

      expect(summary.driverName).toBe('Nguyễn Văn Tài');
      expect(summary.totalAmount).toBe(1500000);
      expect(summary.discountAmount).toBe(225000);
      expect(summary.subtotalAfterDiscount).toBe(1275000);
      expect(summary.deductibleAmount).toBe(500000);
      expect(summary.sanctionAmount).toBe(0);
      expect(summary.totalDeductibleAndSanction).toBe(500000);
      expect(summary.afterSanctionAmount).toBe(775000);
      expect(summary.vatAmount).toBe(102000);
      expect(summary.customerPay).toBe(540000);
      expect(summary.insurancePay).toBe(837000);
      expect(summary.totalPayable).toBe(1377000);
      expect(summary.commissionGeneral).toBe(0);
      expect(summary.commissionGdv).toBe(200000);
      expect(summary.gdvName).toBe('GĐV Bảo Việt');
      expect(summary.commissionMg).toBe(0);
      expect(summary.isInsurance).toBe(true);
    });

    it('should gracefully handle empty rawData or non-insurance case', () => {
      const summary = KgaraCaseFinancialParserHelper.parseFinancialSummary({});

      expect(summary.driverName).toBeNull();
      expect(summary.totalAmount).toBe(0);
      expect(summary.discountAmount).toBe(0);
      expect(summary.subtotalAfterDiscount).toBe(0);
      expect(summary.deductibleAmount).toBe(0);
      expect(summary.sanctionAmount).toBe(0);
      expect(summary.afterSanctionAmount).toBe(0);
      expect(summary.commissionGeneral).toBe(0);
      expect(summary.commissionGdv).toBe(0);
      expect(summary.commissionMg).toBe(0);
      expect(summary.isInsurance).toBe(false);
    });
  });

  describe('parseJournalCostBreakdown', () => {
    it('should parse journal cost breakdown for 1541, 1542, 1543, 521 correctly', () => {
      const journalItems = [
        {
          TaiKhoanNoCode: '1543',
          ChiPhi: 200000,
          NoiDung: 'Hoa hồng bảo hiểm',
        },
        {
          TaiKhoanNoCode: '1542',
          ChiPhi: 220000,
          NoiDung: 'Thuê gia công pha sơn',
        },
        { TaiKhoanNoCode: '521', ChiPhi: 225000, NoiDung: 'Chiết khấu' },
      ];
      const breakdown =
        KgaraCaseFinancialParserHelper.parseJournalCostBreakdown(journalItems);
      expect(breakdown.commissionCost).toBe(200000);
      expect(breakdown.outsourceCost).toBe(220000);
      expect(breakdown.discountCost).toBe(225000);
      expect(breakdown.warehousePartsCost).toBe(0);
      expect(breakdown.totalCost).toBe(645000);
    });
  });

  describe('extractServiceOutsourceCost', () => {
    it('should extract GCN direct field if present', () => {
      const line = { GCN: 220000 };
      expect(
        KgaraCaseFinancialParserHelper.extractServiceOutsourceCost(line),
      ).toBe(220000);
    });

    it('should extract from HTThanhToanThueNgoaiCode CN-GCN', () => {
      const line = {
        HTThanhToanThueNgoaiCode: 'CN-GCN',
        TienThueNgoai: 150000,
      };
      expect(
        KgaraCaseFinancialParserHelper.extractServiceOutsourceCost(line),
      ).toBe(150000);
    });

    it('should return 0 when no outsource cost is defined', () => {
      expect(
        KgaraCaseFinancialParserHelper.extractServiceOutsourceCost({}),
      ).toBe(0);
      expect(
        KgaraCaseFinancialParserHelper.extractServiceOutsourceCost(null),
      ).toBe(0);
    });
  });

  describe('calculateEstimatedProfit', () => {
    it('should compute exact profit metrics matching printed document: 855,000 pre-tax and 957,000 after-tax', () => {
      const summary = KgaraCaseFinancialParserHelper.parseFinancialSummary(
        mockPayloadGrPdv2606_0025,
      );

      const profitCalc =
        KgaraCaseFinancialParserHelper.calculateEstimatedProfit(
          summary,
          0, // parts inside
          0, // parts outside
          220000, // outsource GCN
        );

      expect(profitCalc.totalCost).toBe(220000);
      expect(profitCalc.estimatedProfitPreTax).toBe(855000);
      expect(profitCalc.estimatedProfitAfterTax).toBe(957000);
    });
  });
});

describe('resolveCaseVatAmount', () => {
  it('ưu tiên rawData.TienThue khi có', () => {
    expect(
      resolveCaseVatAmount({
        tienCoThue: 2106000,
        rawData: { TienThue: 156000, TienThueKH: 1 },
      }),
    ).toBe(156000);
  });

  it('cộng TienThueKH và TienThueBH khi không có TienThue', () => {
    expect(
      resolveCaseVatAmount({
        rawData: { TienThueKH: 100000, TienThueBH: 50000 },
      }),
    ).toBe(150000);
  });

  it('suy ra từ tổng dòng (tienCoThue - tienChuaThue) khi có thuế ở dòng', () => {
    expect(
      resolveCaseVatAmount({ rawData: {} }, [
        { tienCoThue: 1080000, tienChuaThue: 1000000 },
      ]),
    ).toBe(80000);
  });

  it('suy ra từ chênh lệch tổng phiếu khi dòng không có thuế và khớp 8%', () => {
    // Phiếu GR-PDV2607-0046: 2.106.000 - 1.950.000 = 156.000 = 8% của 1.950.000
    expect(
      resolveCaseVatAmount({ tienCoThue: 2106000, rawData: {} }, [
        { tienCoThue: 1950000, tienChuaThue: 1950000 },
      ]),
    ).toBe(156000);
  });

  it('trả về 0 khi chênh lệch không khớp thuế suất chuẩn (chiết khấu/phụ phí)', () => {
    expect(
      resolveCaseVatAmount({ tienCoThue: 2000000, rawData: {} }, [
        { tienCoThue: 1950000, tienChuaThue: 1950000 },
      ]),
    ).toBe(0);
  });

  it('trả về 0 khi tổng phiếu nhỏ hơn tổng dòng', () => {
    expect(
      resolveCaseVatAmount({ tienCoThue: 1000000, rawData: {} }, [
        { tienCoThue: 1950000, tienChuaThue: 1950000 },
      ]),
    ).toBe(0);
  });
});
