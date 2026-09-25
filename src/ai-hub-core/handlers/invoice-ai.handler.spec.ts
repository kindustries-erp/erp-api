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
});
