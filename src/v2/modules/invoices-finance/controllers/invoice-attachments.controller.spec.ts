import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { FileAttachmentsService } from '@/v2/modules/file-attachments-management';
import { UploadInvoiceAttachmentBodyDto } from '../dto/invoice-attachment.dto';
import { InvoiceAttachmentsController } from './invoice-attachments.controller';

const permissionsOf = (method: keyof InvoiceAttachmentsController) =>
  Reflect.getMetadata(
    RBAC_PERMISSIONS_KEY,
    InvoiceAttachmentsController.prototype[method],
  ) as Array<{ resource: string; action: string }>;

describe('InvoiceAttachmentsController', () => {
  const files = {
    listForOwner: jest.fn(),
    uploadForOwner: jest.fn(),
    downloadUrlForOwner: jest.fn(),
    deleteForOwner: jest.fn(),
    zipForOwner: jest.fn(),
  };
  const controller = new InvoiceAttachmentsController(
    files as unknown as FileAttachmentsService,
  );
  const req = { user: { sub: 'u1' } };

  beforeEach(() => jest.resetAllMocks());

  it('bảo vệ bằng JwtAuthGuard và CoreRbacGuard (401/403)', () => {
    const guards: unknown[] = Reflect.getMetadata(
      '__guards__',
      InvoiceAttachmentsController,
    );
    expect(guards).toEqual(
      expect.arrayContaining([JwtAuthGuard, CoreRbacGuard]),
    );
  });

  it('quyền: đọc = INVOICES.read, ghi/xóa = INVOICES.update', () => {
    expect(permissionsOf('list')).toEqual([
      { resource: 'invoices', action: 'read' },
    ]);
    expect(permissionsOf('downloadUrl')).toEqual([
      { resource: 'invoices', action: 'read' },
    ]);
    expect(permissionsOf('zip')).toEqual([
      { resource: 'invoices', action: 'read' },
    ]);
    expect(permissionsOf('upload')).toEqual([
      { resource: 'invoices', action: 'update' },
    ]);
    expect(permissionsOf('remove')).toEqual([
      { resource: 'invoices', action: 'update' },
    ]);
  });

  it('zip trả buffer với header application/zip, khóa theo hóa đơn', async () => {
    files.zipForOwner.mockResolvedValue(Buffer.from('zz'));
    const res = { set: jest.fn(), send: jest.fn() };
    await controller.zip('inv-1', res as never);
    expect(files.zipForOwner).toHaveBeenCalledWith('INVOICE', 'inv-1');
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'application/zip' }),
    );
    expect(res.send).toHaveBeenCalledWith(Buffer.from('zz'));
  });

  it('route khai báo theo hóa đơn', () => {
    expect(Reflect.getMetadata('path', InvoiceAttachmentsController)).toBe(
      'api/v2/invoices/:id/attachments',
    );
  });

  it('list ủy quyền cho facade với owner INVOICE', async () => {
    await controller.list('inv-1');
    expect(files.listForOwner).toHaveBeenCalledWith('INVOICE', 'inv-1');
  });

  it('upload dùng category mặc định HOA_DON và ghi người tạo', async () => {
    const f = [{ originalname: 'a.pdf' }] as Express.Multer.File[];
    await controller.upload('inv-1', f, {}, req);
    expect(files.uploadForOwner).toHaveBeenCalledWith({
      ownerType: 'INVOICE',
      ownerId: 'inv-1',
      files: f,
      category: 'HOA_DON',
      userId: 'u1',
    });
  });

  it('upload không có file vẫn chuyển mảng rỗng để service báo 400', async () => {
    await controller.upload('inv-1', undefined as never, {}, req);
    expect(files.uploadForOwner).toHaveBeenCalledWith(
      expect.objectContaining({ files: [] }),
    );
  });

  it('downloadUrl và remove luôn truyền cả hóa đơn lẫn attachmentId (chặn IDOR)', async () => {
    await controller.downloadUrl('inv-1', 'att-1', { inline: true });
    expect(files.downloadUrlForOwner).toHaveBeenCalledWith(
      'INVOICE',
      'inv-1',
      'att-1',
      true,
    );
    await controller.remove('inv-1', 'att-1', req);
    expect(files.deleteForOwner).toHaveBeenCalledWith(
      'INVOICE',
      'inv-1',
      'att-1',
      'u1',
    );
  });

  it('DTO từ chối category lạ', async () => {
    const dto = plainToInstance(UploadInvoiceAttachmentBodyDto, {
      category: 'HACK',
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
    const ok = plainToInstance(UploadInvoiceAttachmentBodyDto, {
      category: 'BANG_KE',
    });
    expect(await validate(ok)).toHaveLength(0);
  });
});
