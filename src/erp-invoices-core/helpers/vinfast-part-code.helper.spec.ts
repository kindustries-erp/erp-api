import {
  extractVinfastItemCode,
  extractStandardItemCode,
  extractOemPartNumber,
  normalizePrefix,
} from './vinfast-part-code.helper';

describe('VinFast Part Code & Standard Prefix Item Code Extraction', () => {
  describe('extractVinfastItemCode', () => {
    it('extracts standard VinFast 3-letter + 8-digit codes with VF- prefix', () => {
      expect(extractVinfastItemCode('EEP63012001AB - VCU_EVCC')).toBe(
        'VF-EEP63012001AB',
      );
      expect(
        extractVinfastItemCode('BEX20000923 - CỤM_MÁNG_HỨNG_CHO_CẦN_LAU_TAY'),
      ).toBe('VF-BEX20000923');
      expect(extractVinfastItemCode('BEX20001166 - ỐP_CẢN_SAU_BÊN_PHẢI')).toBe(
        'VF-BEX20001166',
      );
      expect(
        extractVinfastItemCode('SVC20000011 - CỤM_KẾT_CẤU-KHUNG_CỬA_ĐUÔI_XE'),
      ).toBe('VF-SVC20000011');
      expect(extractVinfastItemCode('EEP20000513 - BỘ_DÂY_CẢN_SAU')).toBe(
        'VF-EEP20000513',
      );
    });

    it('extracts special high-voltage battery packs and motors with VF- prefix', () => {
      expect(
        extractVinfastItemCode('VF5_HV_BATTERY_PACK_38_KWH (Pin cao áp)'),
      ).toBe('VF-EEP73110011AP');
      expect(extractVinfastItemCode('Gói pin HV_BATTERY_41.9KWH')).toBe(
        'VF-BAT21001011',
      );
      expect(extractVinfastItemCode('ĐỘNG CƠ ĐIỆN BẢO HÀNH')).toBe(
        'VF-PVT20030000',
      );
    });

    it('extracts pure numeric VinFast part numbers with VF- prefix', () => {
      expect(extractVinfastItemCode('106206 - Đệm cao su')).toBe('VF-106206');
      expect(extractVinfastItemCode('150012 - Ốp cản')).toBe('VF-150012');
    });
  });

  describe('extractOemPartNumber', () => {
    it('extracts OEM part numbers and adds PT- prefix', () => {
      expect(extractOemPartNumber('0K95K15909 Phớt đuôi trục cơ')).toBe(
        'PT-0K95K15909',
      );
      expect(extractOemPartNumber('214432B020 Phớt láp')).toBe('PT-214432B020');
      expect(extractOemPartNumber('Lốp xe Michelin 225/60R17 Primacy 4')).toBe(
        'PT-225/60R17',
      );
      expect(extractOemPartNumber('A2055018201 Ống nước Mercedes')).toBe(
        'PT-A2055018201',
      );
      expect(extractOemPartNumber('97701-Q6400 Lốc lạnh')).toBe(
        'PT-97701-Q6400',
      );
    });
  });

  describe('normalizePrefix', () => {
    it('normalizes legacy and un-prefixed codes', () => {
      expect(normalizePrefix('BEX20001151')).toBe('VF-BEX20001151');
      expect(normalizePrefix('106206')).toBe('VF-106206');
      expect(normalizePrefix('0K95K15909')).toBe('PT-0K95K15909');
      expect(normalizePrefix('VT-SON-2K')).toBe('VT-SON');
      expect(normalizePrefix('VT-GAS-R134')).toBe('VT-GAS');
      expect(normalizePrefix('VT-DAU-NHOT')).toBe('VT-DAU-NHOT');
      expect(normalizePrefix('VT-CHAT-TAYSON')).toBe('VT-HOACHAT');
      expect(normalizePrefix('VT-BOHO-LAODONG')).toBe('VT-TIEU-HAO');
      expect(normalizePrefix('DV-CUUHO-VANSON')).toBe('DV-CUUHO');
      expect(normalizePrefix('DV-CUOC-GIAOHANG')).toBe('DV-VANCHUYEN');
    });
  });

  describe('extractStandardItemCode (Rule-based Fallback)', () => {
    it('preserves and normalizes existing codes (Preserve Guard)', () => {
      const res1 = extractStandardItemCode({
        existingItemCode: 'BEX20001151',
      });
      expect(res1.itemCode).toBe('VF-BEX20001151');
      expect(res1.itemType).toBe('PARTS');

      const res2 = extractStandardItemCode({
        existingItemCode: 'PT-0K95K15909',
      });
      expect(res2.itemCode).toBe('PT-0K95K15909');
      expect(res2.itemType).toBe('PARTS');
    });

    it('classifies Rescue / Towing lines to single DV-CUUHO', () => {
      const res1 = extractStandardItemCode({
        description: 'Cước Phí Chở Xe BKS 50H-749.34 từ Cần Giờ về Phú Mỹ Hưng',
        sellerName: 'CÔNG TY CỔ PHẦN DỊCH VỤ VÂN SƠN',
        unit: 'Chuyến',
      });
      expect(res1.itemCode).toBe('DV-CUUHO');
      expect(res1.itemType).toBe('SERVICE');
      expect(res1.isDiscountDeduction).toBe(false);

      const res2 = extractStandardItemCode({
        description: 'Cứu hộ cẩu xe sự cố 911',
        sellerName: 'CÔNG TY TNHH CỨU HỘ GIAO THÔNG 911 SÀI GÒN',
      });
      expect(res2.itemCode).toBe('DV-CUUHO');
      expect(res2.itemType).toBe('SERVICE');
    });

    it('classifies Freight / Delivery lines to DV-VANCHUYEN', () => {
      const resGrab = extractStandardItemCode({
        description: 'Cước phí vận chuyển mã IN-2-00CM0N7G9QZH4SXVG8G6',
        sellerName: 'CÔNG TY TNHH GRAB',
        unit: 'Chuyến',
      });
      expect(resGrab.itemCode).toBe('DV-VANCHUYEN');
      expect(resGrab.itemType).toBe('SERVICE');

      const resViettel = extractStandardItemCode({
        description: 'Cước chuyển phát nhanh tháng 03/2026',
        sellerName: 'TỔNG CÔNG TY CP BƯU CHÍNH VIETTEL',
        unit: 'Tháng',
      });
      expect(resViettel.itemCode).toBe('DV-VANCHUYEN');
      expect(resViettel.itemType).toBe('SERVICE');
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

    it('classifies Workshop Consumables (Paint, Gas, Oil, Chemicals, General Consumables)', () => {
      const resPaint = extractStandardItemCode({
        description: 'Sơn bóng EC-150 4:1 - 4L/Lon',
        sellerName: 'CÔNG TY TNHH SƠN HOÀNG ANH',
        unit: 'Lon',
      });
      expect(resPaint.itemCode).toBe('VT-SON');
      expect(resPaint.itemType).toBe('MATERIAL');

      const resGas = extractStandardItemCode({
        description: 'Gas lạnh R134a Dupont',
        unit: 'Bình',
      });
      expect(resGas.itemCode).toBe('VT-GAS');

      const resOil = extractStandardItemCode({
        description: 'Dầu nhớt động cơ Total Quartz 5W30',
        unit: 'Can',
      });
      expect(resOil.itemCode).toBe('VT-DAU-NHOT');

      const resGlue = extractStandardItemCode({
        description: 'Keo silicon Apollo A500',
        unit: 'Chai',
      });
      expect(resGlue.itemCode).toBe('VT-KEO');

      const resChem = extractStandardItemCode({
        description: 'Nước làm mát động cơ Prestone đỏ',
        unit: 'Can',
      });
      expect(resChem.itemCode).toBe('VT-HOACHAT');

      const resConsumable = extractStandardItemCode({
        description: 'Nhám tròn bò cạp Velero 6"P320',
        unit: 'Tờ',
      });
      expect(resConsumable.itemCode).toBe('VT-TIEU-HAO');
    });

    it('classifies Tools (CCDC) and Admin (HC)', () => {
      const resTool = extractStandardItemCode({
        description: 'Súng siết bulong khí nén 1/2 inch',
        unit: 'Cái',
      });
      expect(resTool.itemCode).toBe('CCDC-XUONG');

      const resWater = extractStandardItemCode({
        description: 'NƯỚC ĐÓNG CHAI VIVA-18.5L',
        sellerName: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ CÔNG NGHỆ THIÊN PHƯỚC',
        unit: 'Chai',
      });
      expect(resWater.itemCode).toBe('HC-NUOC');

      const resPaper = extractStandardItemCode({
        description: 'Giấy A4 IK Plus 70gms',
        sellerName: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ LẠC DƯƠNG',
        unit: 'ream',
      });
      expect(resPaper.itemCode).toBe('HC-VPP');
    });
  });
});
