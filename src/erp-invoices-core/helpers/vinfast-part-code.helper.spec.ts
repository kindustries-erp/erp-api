import {
  extractVinfastItemCode,
  extractStandardItemCode,
} from './vinfast-part-code.helper';

describe('VinFast Part Code & Standard Item Code Extraction', () => {
  describe('extractVinfastItemCode', () => {
    it('extracts standard VinFast 3-letter + 8-digit codes with hyphens', () => {
      expect(extractVinfastItemCode('EEP63012001AB - VCU_EVCC')).toBe(
        'EEP63012001AB',
      );
      expect(
        extractVinfastItemCode('BEX20000923 - CỤM_MÁNG_HỨNG_CHO_CẦN_LAU_TAY'),
      ).toBe('BEX20000923');
      expect(extractVinfastItemCode('BEX20001166 - ỐP_CẢN_SAU_BÊN_PHẢI')).toBe(
        'BEX20001166',
      );
      expect(
        extractVinfastItemCode('SVC20000011 - CỤM_KẾT_CẤU-KHUNG_CỬA_ĐUÔI_XE'),
      ).toBe('SVC20000011');
      expect(extractVinfastItemCode('EEP20000513 - BỘ_DÂY_CẢN_SAU')).toBe(
        'EEP20000513',
      );
    });

    it('extracts special high-voltage battery packs and motors', () => {
      expect(
        extractVinfastItemCode('VF5_HV_BATTERY_PACK_38_KWH (Pin cao áp)'),
      ).toBe('EEP73110011AP');
      expect(extractVinfastItemCode('Gói pin HV_BATTERY_41.9KWH')).toBe(
        'BAT21001011',
      );
      expect(extractVinfastItemCode('ĐỘNG CƠ ĐIỆN BẢO HÀNH')).toBe(
        'PVT20030000',
      );
    });
  });

  describe('extractStandardItemCode (Rule-based Fallback)', () => {
    it('preserves existing code when present (Preserve Guard)', () => {
      const res = extractStandardItemCode({
        existingItemCode: 'CUSTOM-SKU-123',
        description: 'Bất kỳ mô tả nào',
      });
      expect(res.itemCode).toBe('CUSTOM-SKU-123');
      expect(res.source).toBe('EXISTING_PRESERVED');
    });

    it('classifies Rescue / Towing lines correctly', () => {
      const res1 = extractStandardItemCode({
        description: 'Cước Phí Chở Xe BKS 50H-749.34 từ Cần Giờ về Phú Mỹ Hưng',
        sellerName: 'CÔNG TY CỔ PHẦN DỊCH VỤ VÂN SƠN',
        unit: 'Chuyến',
      });
      expect(res1.itemCode).toBe('DV-CUUHO-VANSON');
      expect(res1.itemType).toBe('SERVICE');
      expect(res1.isDiscountDeduction).toBe(false);

      const res2 = extractStandardItemCode({
        description: 'Cứu hộ cẩu xe sự cố 911',
        sellerName: 'CÔNG TY TNHH CỨU HỘ GIAO THÔNG 911 SÀI GÒN',
      });
      expect(res2.itemCode).toBe('DV-CUUHO-911');
      expect(res2.itemType).toBe('SERVICE');
    });

    it('classifies Discounts & Rebates as deductions', () => {
      const res1 = extractStandardItemCode({
        description: 'Chiết khấu mã A-9MVK34HGWL8TAV',
        sellerName: 'CÔNG TY TNHH GRAB',
        preVatAmount: 14815,
      });
      expect(res1.itemCode).toBe('CK-GRAB');
      expect(res1.itemType).toBe('DISCOUNT');
      expect(res1.isDiscountDeduction).toBe(true);

      const res2 = extractStandardItemCode({
        description: 'Chiết khấu thương mại/ giảm giá mã 01KVG2A48WB7FN',
        sellerName: 'CÔNG TY CỔ PHẦN DI CHUYỂN XANH VÀ THÔNG MINH GSM',
        preVatAmount: 15741,
      });
      expect(res2.itemCode).toBe('CK-GSM');
      expect(res2.itemType).toBe('DISCOUNT');
      expect(res2.isDiscountDeduction).toBe(true);
    });

    it('classifies Subcontract & Machining lines', () => {
      const res = extractStandardItemCode({
        description: 'GIA CÔNG MÂM Ô TÔ',
        sellerName: 'CÔNG TY TNHH KỸ THUẬT Ô TÔ TNT',
        unit: 'Cái',
      });
      expect(res.itemCode).toBe('DV-GIACONG-MAM');
      expect(res.itemType).toBe('SERVICE');
    });

    it('classifies Facility & Operating Services', () => {
      const resSecurity = extractStandardItemCode({
        description: 'Phí dịch vụ bảo vệ an ninh mục tiêu',
        sellerName: 'CÔNG TY DỊCH VỤ BẢO VỆ THẮNG LỢI 24H',
      });
      expect(resSecurity.itemCode).toBe('DV-BAOVE');
      expect(resSecurity.itemType).toBe('SERVICE');

      const resCleaning = extractStandardItemCode({
        description: 'Dịch vụ vệ sinh công nghiệp xưởng',
        sellerName: 'CÔNG TY TRÍ ĐỨC CLEAN',
      });
      expect(resCleaning.itemCode).toBe('DV-VESINH');
    });

    it('classifies Workshop Consumables (Paint, Oil, Gas)', () => {
      const resPaint = extractStandardItemCode({
        description: 'Sơn bóng EC-150 4:1 - 4L/Lon',
        sellerName: 'CÔNG TY TNHH SƠN HOÀNG ANH',
        unit: 'Lon',
      });
      expect(resPaint.itemCode).toBe('VT-SON-2K');
      expect(resPaint.itemType).toBe('MATERIAL');
    });
  });
});
