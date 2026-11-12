import { BadRequestException } from '@nestjs/common';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { AiHubGarageService } from '../ai-hub-garage.service';
import { CreatePrFromInvoiceDto } from '../dto/create-pr-from-invoice.dto';
import { AiHubGarageController } from './ai-hub-garage.controller';

describe('AiHubGarageController', () => {
  let service: { previewInvoice: jest.Mock; createPurchaseRequest: jest.Mock };
  let controller: AiHubGarageController;
  const req = { user: { sub: 'u1' } };

  beforeEach(() => {
    service = {
      previewInvoice: jest.fn().mockResolvedValue({ lines: [] }),
      createPurchaseRequest: jest.fn().mockResolvedValue({ requestId: 'r1' }),
    };
    controller = new AiHubGarageController(
      service as unknown as AiHubGarageService,
    );
  });

  it('chuyển file hợp lệ và người gọi xuống facade', async () => {
    const file = {
      buffer: Buffer.from('%PDF-1.4'),
      mimetype: 'application/pdf',
      originalname: 'hd.pdf',
    } as Express.Multer.File;

    await controller.previewInvoice(file, req);

    expect(service.previewInvoice).toHaveBeenCalledWith(
      { buffer: file.buffer, mimeType: 'application/pdf', fileName: 'hd.pdf' },
      'u1',
    );
  });

  it('từ chối khi thiếu file hoặc nội dung không khớp loại', () => {
    expect(() => controller.previewInvoice(undefined, req)).toThrow(
      BadRequestException,
    );
    const fake = {
      buffer: Buffer.from('<script>'),
      mimetype: 'image/png',
      originalname: 'x.png',
    } as Express.Multer.File;
    expect(() => controller.previewInvoice(fake, req)).toThrow(
      BadRequestException,
    );
    expect(service.previewInvoice).not.toHaveBeenCalled();
  });

  it('tạo PR với id người gọi', async () => {
    const dto = { lines: [] } as unknown as CreatePrFromInvoiceDto;

    await controller.createPurchaseRequest(dto, req);

    expect(service.createPurchaseRequest).toHaveBeenCalledWith(dto, 'u1');
  });

  it('khai báo quyền: xem trước cần ai_hub_garage, tạo PR cần thêm quyền tạo đề nghị', () => {
    const permissionsOf = (method: keyof AiHubGarageController) =>
      Reflect.getMetadata(RBAC_PERMISSIONS_KEY, controller[method]);

    expect(permissionsOf('previewInvoice')).toEqual([
      { resource: 'ai_hub_garage', action: 'create' },
    ]);
    expect(permissionsOf('createPurchaseRequest')).toEqual([
      { resource: 'ai_hub_garage', action: 'create' },
      { resource: 'garage_procurement_requests', action: 'create' },
    ]);
  });
});
