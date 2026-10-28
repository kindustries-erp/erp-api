import { BadRequestException } from '@nestjs/common';
import { InvoiceOriginalPdfController } from './invoice-original-pdf.controller';
import { InvoiceOriginalPdfFacade } from '../services/original-pdf/invoice-original-pdf.facade';

describe('InvoiceOriginalPdfController', () => {
  let controller: InvoiceOriginalPdfController;
  let facade: Partial<InvoiceOriginalPdfFacade>;

  beforeEach(() => {
    facade = {
      uploadManualPdf: jest.fn().mockResolvedValue({
        invoiceId: 'inv-1',
        pdfFileKey: 'invoices/pdf/inv-1.pdf',
        pdfSource: 'manual_upload',
      }),
    };
    controller = new InvoiceOriginalPdfController(
      facade as InvoiceOriginalPdfFacade,
    );
  });

  it('forwards the uploaded PDF buffer to the facade', async () => {
    const file = { buffer: Buffer.from('%PDF-1.4') } as Express.Multer.File;

    const res = await controller.uploadManualPdf('inv-1', file);

    expect(facade.uploadManualPdf).toHaveBeenCalledWith('inv-1', file.buffer);
    expect(res.pdfSource).toBe('manual_upload');
  });

  it('rejects a request without a file', async () => {
    await expect(
      controller.uploadManualPdf('inv-1', undefined as any),
    ).rejects.toThrow(BadRequestException);
    expect(facade.uploadManualPdf).not.toHaveBeenCalled();
  });
});
