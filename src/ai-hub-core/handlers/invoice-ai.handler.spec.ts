import { InvoiceAiHandler } from './invoice-ai.handler';
import { NineRouterClient } from '../clients/nine-router.client';

describe('InvoiceAiHandler', () => {
  let handler: InvoiceAiHandler;
  let mockNineRouterClient: Partial<NineRouterClient>;

  beforeEach(() => {
    mockNineRouterClient = {
      complete: jest.fn(),
    };
    handler = new InvoiceAiHandler(mockNineRouterClient as NineRouterClient);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should extract license plate from TOON input correctly', async () => {
    const mockAiResponse = {
      id: 'chatcmpl-1',
      object: 'chat.completion',
      created: 1700000000,
      model: 'gemini-3.7-flash-tiered',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              licensePlate: '50F-090.80',
              formattedPlate: '50F-090.80',
              settlementOrder: '0173250/ TP HCM',
              confidence: 0.98,
              reason: 'Found in invoice description and item 1',
            }),
          },
          finish_reason: 'stop',
        },
      ],
    };

    (mockNineRouterClient.complete as jest.Mock).mockResolvedValue(
      mockAiResponse,
    );

    const result = await handler.extractLicensePlate({
      invoiceNo: '1736',
      serialNo: 'C26TGA',
      invoiceDate: '2026-09-23',
      description:
        'CHI PHÍ SỬA CHỮA XE BKS 50F-090.80 BẢO LÃNH SỐ 0173250/ TP HCM',
      items: [
        { description: 'Sơn cốp sau', quantity: 1, totalAmount: 1296000 },
      ],
    });

    expect(result.licensePlate).toBe('50F-090.80');
    expect(result.formattedPlate).toBe('50F-090.80');
    expect(result.confidence).toBe(0.98);
    expect(mockNineRouterClient.complete).toHaveBeenCalled();
  });

  it('should handle markdown-wrapped json safely', async () => {
    const markdownResponse = {
      id: 'chatcmpl-2',
      object: 'chat.completion',
      created: 1700000000,
      model: 'gemini-3.7-flash-tiered',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content:
              '```json\n{\n  "licensePlate": "50H31973",\n  "formattedPlate": "50H-319.73",\n  "confidence": 0.95\n}\n```',
          },
          finish_reason: 'stop',
        },
      ],
    };

    (mockNineRouterClient.complete as jest.Mock).mockResolvedValue(
      markdownResponse,
    );

    const result = await handler.extractLicensePlate({
      invoiceNo: '1720',
      description: 'CHI PHÍ SỬA CHỮA XE BKS 50H-319.73',
    });

    expect(result.licensePlate).toBe('50H31973');
    expect(result.formattedPlate).toBe('50H-319.73');
  });

  it('should fallback gracefully when AI response is unparseable', async () => {
    const brokenResponse = {
      id: 'chatcmpl-3',
      object: 'chat.completion',
      created: 1700000000,
      model: 'gemini-3.7-flash-tiered',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Không tìm thấy biển số',
          },
          finish_reason: 'stop',
        },
      ],
    };

    (mockNineRouterClient.complete as jest.Mock).mockResolvedValue(
      brokenResponse,
    );

    const result = await handler.extractLicensePlate({
      invoiceNo: '9999',
      description: 'Tiếp khách ăn trưa',
    });

    expect(result.licensePlate).toBeNull();
    expect(result.confidence).toBe(0);
  });

  describe('classifyInvoiceCategory', () => {
    it('should immediately return VF_PARTS when sellerTaxCode matches VinFast without calling AI', async () => {
      const result = await handler.classifyInvoiceCategory({
        invoiceNo: '1234',
        sellerTaxCode: '0108926276',
        sellerName: 'CÔNG TY TNHH KINH DOANH THƯƠNG MẠI VÀ DỊCH VỤ VINFAST',
        description: 'Phụ tùng xe VF8',
      });

      expect(result.categoryCode).toBe('VF_PARTS');
      expect(result.confidence).toBe(1.0);
      expect(result.isVfDirectMatch).toBe(true);
      expect(mockNineRouterClient.complete).not.toHaveBeenCalled();
    });

    it('should classify Grab Express into OPEX_LOGISTICS via 9router AI', async () => {
      const mockAiResponse = {
        id: 'chatcmpl-grab',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gemini-3.7-flash-tiered',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                categoryCode: 'OPEX_LOGISTICS',
                confidence: 0.95,
                reason: 'Cước phí vận chuyển Grab Express',
              }),
            },
            finish_reason: 'stop',
          },
        ],
      };

      (mockNineRouterClient.complete as jest.Mock).mockResolvedValue(
        mockAiResponse,
      );

      const result = await handler.classifyInvoiceCategory({
        invoiceNo: '503887',
        sellerTaxCode: '0312650437',
        sellerName: 'CÔNG TY TNHH GRAB',
        description: 'Cước phí vận chuyển hàng hóa',
        totalAmount: 65000,
      });

      expect(result.categoryCode).toBe('OPEX_LOGISTICS');
      expect(result.confidence).toBe(0.95);
      expect(mockNineRouterClient.complete).toHaveBeenCalled();
    });

    it('should fallback to null when AI confidence is low (< 0.7)', async () => {
      const mockAiResponse = {
        id: 'chatcmpl-low',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gemini-3.7-flash-tiered',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                categoryCode: 'OPEX_ADMIN',
                confidence: 0.55,
                reason: 'Không chắc chắn nội dung hóa đơn',
              }),
            },
            finish_reason: 'stop',
          },
        ],
      };

      (mockNineRouterClient.complete as jest.Mock).mockResolvedValue(
        mockAiResponse,
      );

      const result = await handler.classifyInvoiceCategory({
        invoiceNo: '9999',
        sellerName: 'Công ty ABC',
        description: 'Chi phí không rõ',
      });

      expect(result.categoryCode).toBeNull();
      expect(result.confidence).toBe(0.55);
    });

    it('should fallback to null when AI throws an error', async () => {
      (mockNineRouterClient.complete as jest.Mock).mockRejectedValue(
        new Error('9router network timeout'),
      );

      const result = await handler.classifyInvoiceCategory({
        invoiceNo: '8888',
        sellerName: 'Công ty XYZ',
        description: 'Mua hàng',
      });

      expect(result.categoryCode).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.reason).toContain('AI Failure');
    });
  });

  describe('classifyInvoiceLineItemsWithAi', () => {
    it('should extract VinFast part numbers, rescue, discount, and materials via AI', async () => {
      const mockAiResponse = {
        id: 'chatcmpl-items',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gemini-3.7-flash-tiered',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                items: [
                  {
                    lineIndex: 0,
                    itemCode: 'BIW20002460',
                    itemType: 'PARTS',
                    isDiscountDeduction: false,
                    confidence: 0.98,
                    reason: 'Mã phụ tùng VinFast chính hãng',
                  },
                  {
                    lineIndex: 1,
                    itemCode: 'DV-CUUHO-VANSON',
                    itemType: 'SERVICE',
                    isDiscountDeduction: false,
                    confidence: 0.95,
                    reason: 'Cước chở xe cứu hộ Vân Sơn',
                  },
                  {
                    lineIndex: 2,
                    itemCode: 'CK-GRAB',
                    itemType: 'DISCOUNT',
                    isDiscountDeduction: true,
                    confidence: 0.99,
                    reason: 'Dòng chiết khấu trừ vào cước Grab',
                  },
                ],
              }),
            },
            finish_reason: 'stop',
          },
        ],
      };

      (mockNineRouterClient.complete as jest.Mock).mockResolvedValue(
        mockAiResponse,
      );

      const result = await handler.classifyInvoiceLineItemsWithAi([
        {
          lineIndex: 0,
          description: 'BIW20002460 - ĐỆM_CAO_SU_TAY_NẮM_MỞ_CỬA',
          quantity: 3,
          unitPrice: 27063,
          sellerName: 'CÔNG TY CỔ PHẦN VINFAST VIỆT NAM',
        },
        {
          lineIndex: 1,
          description: 'Cước Phí Chở Xe BKS 50H-749.34 về Phú Mỹ Hưng',
          unit: 'Chuyến',
          sellerName: 'CÔNG TY CỔ PHẦN DỊCH VỤ VÂN SƠN',
        },
        {
          lineIndex: 2,
          description: 'Chiết khấu mã A-9MVK34HGWL8TAV',
          preVatAmount: 14815,
          sellerName: 'CÔNG TY TNHH GRAB',
        },
      ]);

      expect(result).toHaveLength(3);
      expect(result[0].itemCode).toBe('BIW20002460');
      expect(result[0].itemType).toBe('PARTS');
      expect(result[1].itemCode).toBe('DV-CUUHO-VANSON');
      expect(result[1].itemType).toBe('SERVICE');
      expect(result[2].itemCode).toBe('CK-GRAB');
      expect(result[2].itemType).toBe('DISCOUNT');
      expect(result[2].isDiscountDeduction).toBe(true);
    });

    it('should return empty array when input items is empty', async () => {
      const result = await handler.classifyInvoiceLineItemsWithAi([]);
      expect(result).toEqual([]);
      expect(mockNineRouterClient.complete).not.toHaveBeenCalled();
    });
  });
});
