import { InvoiceFilesService } from './invoice-files.service';

const attachment = {
  id: 'att-1',
  fileKey: 'files/a.pdf',
  fileName: 'a.pdf',
  fileSize: '123',
  mimeType: 'application/pdf',
  documentType: 'HOP_DONG',
};

const make = () => {
  const invoiceRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue({ id: 'inv-1', pdfFileKey: null, attachments: [] }),
    save: jest.fn(),
    update: jest.fn(),
  };
  const linkRepo = {
    create: jest.fn((v) => v),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
  const attachments = { uploadFile: jest.fn().mockResolvedValue(attachment) };
  const r2 = { deleteObject: jest.fn().mockResolvedValue(undefined) };
  const registrar = {
    register: jest.fn().mockResolvedValue(true),
    registerInvoiceFile: jest.fn().mockResolvedValue(true),
    unregister: jest.fn().mockResolvedValue(1),
  };
  const svc = new InvoiceFilesService(
    invoiceRepo as never,
    linkRepo as never,
    r2 as never,
    attachments as never,
    {} as never,
    registrar as never,
  );
  return { svc, invoiceRepo, linkRepo, registrar };
};

describe('InvoiceFilesService → V2 registrar', () => {
  it('uploadPdfs đăng ký file vào V2 với nguồn erp_attachments và category của V1', async () => {
    const { svc, registrar } = make();
    await svc.uploadPdfs(
      'inv-1',
      [
        {
          filename: 'a.pdf',
          buffer: Buffer.from('x'),
          mimetype: 'application/pdf',
        },
      ],
      'HOP_DONG',
      'user-1',
    );
    expect(registrar.register).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'inv-1',
        fileKey: 'files/a.pdf',
        fileSize: 123,
        category: 'HOP_DONG',
        legacySource: 'erp_attachments:att-1',
      }),
    );
  });

  it('unlinkAttachment xóa mềm dòng V2 theo khóa của attachment đã gỡ', async () => {
    const { svc, linkRepo, registrar } = make();
    linkRepo.findOne.mockResolvedValue({ attachment });
    await svc.unlinkAttachment('inv-1', 'att-1');
    expect(registrar.unregister).toHaveBeenCalledWith(
      'INVOICE',
      'inv-1',
      'files/a.pdf',
    );
  });

  it('unlinkAttachment không gọi registrar khi không có liên kết', async () => {
    const { svc, linkRepo, registrar } = make();
    linkRepo.findOne.mockResolvedValue(null);
    await svc.unlinkAttachment('inv-1', 'att-1');
    expect(registrar.unregister).not.toHaveBeenCalled();
  });

  it('deletePdf xóa mềm dòng V2 sau khi xóa object V1', async () => {
    const { svc, registrar } = make();
    await svc.deletePdf('inv-1', 'files/a.pdf');
    expect(registrar.unregister).toHaveBeenCalledWith(
      'INVOICE',
      'inv-1',
      'files/a.pdf',
    );
  });

  it('chạy bình thường khi không có registrar (Optional)', async () => {
    const { invoiceRepo, linkRepo } = make();
    const svc = new InvoiceFilesService(
      invoiceRepo as never,
      linkRepo as never,
      { deleteObject: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      {} as never,
    );
    await expect(svc.deletePdf('inv-1', 'k')).resolves.toEqual({
      success: true,
    });
  });
});
