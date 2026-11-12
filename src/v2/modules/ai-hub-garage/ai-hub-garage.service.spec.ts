import { GarageItemMatchService } from '@/v2/modules/items-garage/services/garage-item-match.service';
import { CreatePrFromInvoiceDto } from './dto/create-pr-from-invoice.dto';
import { GarageInvoiceExtractService } from './services/garage-invoice-extract.service';
import { GaragePrFromInvoiceService } from './services/garage-pr-from-invoice.service';
import { AiHubGarageService } from './ai-hub-garage.service';

describe('AiHubGarageService', () => {
  const file = {
    buffer: Buffer.from('x'),
    mimeType: 'image/png',
    fileName: 'a.png',
  };
  const lines = [
    {
      itemName: 'Lọc dầu',
      itemCode: null,
      unit: null,
      quantity: 1,
      unitPrice: 10,
      itemType: 'PT',
    },
  ];
  let extractor: { extract: jest.Mock };
  let items: { match: jest.Mock };
  let prFromInvoice: { create: jest.Mock };
  let service: AiHubGarageService;

  beforeEach(() => {
    extractor = {
      extract: jest.fn().mockResolvedValue({
        data: {
          invoice: { total: null },
          lines,
          skippedLines: 0,
        },
        tier: 'low',
        model: 'm-low',
        latencyMs: 3,
      }),
    };
    items = {
      match: jest.fn().mockResolvedValue([{ status: 'NEW', itemType: 'PT' }]),
    };
    prFromInvoice = {
      create: jest.fn().mockResolvedValue({ requestId: 'r1' }),
    };
    service = new AiHubGarageService(
      extractor as unknown as GarageInvoiceExtractService,
      items as unknown as GarageItemMatchService,
      prFromInvoice as unknown as GaragePrFromInvoiceService,
    );
  });

  it('xem trước: đọc hóa đơn rồi đối chiếu danh mục, không ghi DB', async () => {
    const preview = await service.previewInvoice(file, 'u1');

    expect(extractor.extract).toHaveBeenCalledWith(file, {
      actorUserId: 'u1',
    });
    expect(items.match).toHaveBeenCalledWith(lines);
    expect(prFromInvoice.create).not.toHaveBeenCalled();
    expect(preview.lines[0].match.status).toBe('NEW');
    expect(preview.ai.tier).toBe('low');
  });

  it('xác nhận: chuyển xuống service tạo PR', async () => {
    const dto = { lines: [] } as unknown as CreatePrFromInvoiceDto;

    await expect(service.createPurchaseRequest(dto, 'u1')).resolves.toEqual({
      requestId: 'r1',
    });
    expect(prFromInvoice.create).toHaveBeenCalledWith(dto, 'u1');
  });
});
