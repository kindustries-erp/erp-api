import { DataSource } from 'typeorm';
import { ErpInvoiceItemSubscriber } from './erp-invoice-item.subscriber';
import { extractVinfastItemCode } from '../helpers/vinfast-part-code.helper';
import { ErpInvoiceItem } from '../entities/erp_invoice_item.entity';

describe('VinFast Part Code Extraction & ErpInvoiceItemSubscriber', () => {
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

    it('extracts space-separated codes without hyphens', () => {
      expect(
        extractVinfastItemCode('SVC73000177 BÓNG ĐÈN 12V55W (BULB 12V55W)'),
      ).toBe('SVC73000177');
      expect(
        extractVinfastItemCode('CHS30019126 CẢM BIẾN ÁP SUẤT LỐP XE 315MHZ'),
      ).toBe('CHS30019126');
      expect(extractVinfastItemCode('CHS20000072  VAN LỐP')).toBe(
        'CHS20000072',
      );
      expect(extractVinfastItemCode('CHS20000516 VÀNH NHÔM')).toBe(
        'CHS20000516',
      );
      expect(extractVinfastItemCode('SVC20000093 Bóng đèn xi nhan')).toBe(
        'SVC20000093',
      );
    });

    it('extracts codes with 4-6 letter prefixes', () => {
      expect(extractVinfastItemCode('BEXSZT62052AA - HL_WIPER_BLADE_L')).toBe(
        'BEXSZT62052AA',
      );
      expect(
        extractVinfastItemCode(
          'BEXTM350503AB LƯỠI GẠT NƯỚC KÍNH CHẮN GIÓ BÊN PHẢI',
        ),
      ).toBe('BEXTM350503AB');
      expect(
        extractVinfastItemCode(
          'BEXT3050505AA LƯỠI GẠT NƯỚC KÍNH CHẮN GIÓ BÊN TRÁI',
        ),
      ).toBe('BEXT3050505AA');
      expect(
        extractVinfastItemCode(
          'BEX73020504AD FRONT WHEEL ARCH CLADDING ASSY RH',
        ),
      ).toBe('BEX73020504AD');
    });

    it('extracts special battery models and warranty motors', () => {
      expect(extractVinfastItemCode('HV_BATTERY_41.9KWH')).toBe('BAT21001011');
      expect(extractVinfastItemCode('VF5_HV_BATTERY_PACK_38_KWH')).toBe(
        'EEP73110011AP',
      );
      expect(extractVinfastItemCode('Gói pin HV_BATTERY_PACK')).toBe(
        'EEP73110011ALL',
      );
      expect(extractVinfastItemCode('ĐỘNG CƠ ĐIỆN BẢO HÀNH')).toBe(
        'PVT20030000',
      );
    });

    it('returns null for general services, labor, and non-part descriptions', () => {
      expect(extractVinfastItemCode('Bảo dưỡng cấp 1')).toBeNull();
      expect(
        extractVinfastItemCode('SỬA XE 50E82734 QT S52801-WO-260914-0014'),
      ).toBeNull();
      expect(
        extractVinfastItemCode('Công tháo lắp tấm trần & rèm che nắng'),
      ).toBeNull();
      expect(extractVinfastItemCode('Sơn ốp lườn trái')).toBeNull();
      expect(extractVinfastItemCode('')).toBeNull();
      expect(extractVinfastItemCode(null)).toBeNull();
    });
  });

  describe('ErpInvoiceItemSubscriber lifecycle', () => {
    let subscriber: ErpInvoiceItemSubscriber;
    let mockDataSource: Partial<DataSource>;

    beforeEach(() => {
      mockDataSource = {
        subscribers: [],
      };
      subscriber = new ErpInvoiceItemSubscriber(mockDataSource as DataSource);
    });

    it('registers itself to DataSource subscribers on instantiation', () => {
      expect(mockDataSource.subscribers).toContain(subscriber);
      expect(subscriber.listenTo()).toBe(ErpInvoiceItem);
    });

    it('sets itemCode on beforeInsert if missing', () => {
      const entity = new ErpInvoiceItem();
      entity.description = 'EEP63012001VJ - VCU_EVCC';
      entity.itemCode = null;

      subscriber.beforeInsert({ entity } as any);
      expect(entity.itemCode).toBe('EEP63012001VJ');
    });

    it('does not overwrite existing itemCode on beforeInsert', () => {
      const entity = new ErpInvoiceItem();
      entity.description = 'EEP63012001VJ - VCU_EVCC';
      entity.itemCode = 'CUSTOM_CODE';

      subscriber.beforeInsert({ entity } as any);
      expect(entity.itemCode).toBe('CUSTOM_CODE');
    });

    it('updates itemCode on beforeUpdate if description changes', () => {
      const entity = new ErpInvoiceItem();
      entity.description = 'BEX20000881 - NẮP';
      const databaseEntity = {
        description: 'Old description',
      } as ErpInvoiceItem;

      subscriber.beforeUpdate({ entity, databaseEntity } as any);
      expect(entity.itemCode).toBe('BEX20000881');
    });
  });
});
