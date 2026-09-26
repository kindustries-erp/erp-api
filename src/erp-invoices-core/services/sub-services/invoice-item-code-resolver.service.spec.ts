import { InvoiceItemCodeResolverService } from './invoice-item-code-resolver.service';
import { InvoiceAiHandler } from '../../../ai-hub-core/handlers/invoice-ai.handler';

describe('InvoiceItemCodeResolverService', () => {
  let service: InvoiceItemCodeResolverService;
  let mockInvoiceAiHandler: Partial<InvoiceAiHandler>;

  beforeEach(() => {
    mockInvoiceAiHandler = {
      classifyInvoiceLineItemsWithAi: jest.fn(),
    };
    service = new InvoiceItemCodeResolverService(
      mockInvoiceAiHandler as InvoiceAiHandler,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should preserve and normalize existing itemCode when present (Preserve Guard)', async () => {
    const result = await service.resolveBatch([
      {
        lineIndex: 0,
        existingItemCode: 'PT-CUSTOM-PRESERVED-CODE',
        description: 'Bất kỳ mô tả nào',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].itemCode).toBe('PT-CUSTOM-PRESERVED-CODE');
    expect(result[0].source).toBe('EXISTING_PRESERVED');
    expect(
      mockInvoiceAiHandler.classifyInvoiceLineItemsWithAi,
    ).not.toHaveBeenCalled();
  });

  it('should use AI results and ensure prefix normalization when AI returns valid code', async () => {
    (
      mockInvoiceAiHandler.classifyInvoiceLineItemsWithAi as jest.Mock
    ).mockResolvedValue([
      {
        lineIndex: 0,
        itemCode: 'VF-BIW20002460',
        itemType: 'PARTS',
        isDiscountDeduction: false,
        confidence: 0.98,
        reason: 'Phụ tùng VinFast chính hãng',
      },
    ]);

    const result = await service.resolveBatch([
      {
        lineIndex: 0,
        description: 'BIW20002460 - ĐỆM CAO SU TAY NẮM',
        sellerName: 'CÔNG TY CỔ PHẦN VINFAST VIỆT NAM',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].itemCode).toBe('VF-BIW20002460');
    expect(result[0].itemType).toBe('PARTS');
    expect(result[0].source).toBe('AI_CLASSIFIED');
  });

  it('should fallback to Rule-based engine when AI fails and produce standard prefix', async () => {
    (
      mockInvoiceAiHandler.classifyInvoiceLineItemsWithAi as jest.Mock
    ).mockRejectedValue(new Error('9router network error'));

    const result = await service.resolveBatch([
      {
        lineIndex: 0,
        description: 'Cước Phí Chở Xe BKS 50H-749.34 về Phú Mỹ Hưng',
        unit: 'Chuyến',
        sellerName: 'CÔNG TY CỔ PHẦN DỊCH VỤ VÂN SƠN',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].itemCode).toBe('DV-CUUHO');
    expect(result[0].itemType).toBe('SERVICE');
    expect(result[0].source).toBe('RESCUE_RULE');
  });

  it('should identify Grab discounts as deduction in fallback', async () => {
    (
      mockInvoiceAiHandler.classifyInvoiceLineItemsWithAi as jest.Mock
    ).mockResolvedValue([]);

    const result = await service.resolveBatch([
      {
        lineIndex: 0,
        description: 'Chiết khấu mã A-9MVK34HGWL8TAV',
        preVatAmount: 14815,
        sellerName: 'CÔNG TY TNHH GRAB',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].itemCode).toBe('CK-GRAB');
    expect(result[0].itemType).toBe('DISCOUNT');
    expect(result[0].isDiscountDeduction).toBe(true);
  });
});
