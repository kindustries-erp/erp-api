import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ErpInvoicesCoreController } from './erp-invoices-core.controller';

describe('ErpInvoicesCoreController', () => {
  let controller: ErpInvoicesCoreController;
  const service = {
    syncFromPortal: jest.fn(),
    linkVouchersToInvoice: jest.fn(),
    removeVoucherFromInvoice: jest.fn(),
  } as any;
  const notificationsService = {
    createForUser: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ErpInvoicesCoreController(service, notificationsService);
  });

  it('sends notification when taxpayer mismatch happens', async () => {
    service.syncFromPortal.mockRejectedValue(
      new BadRequestException('GDT_TAXPAYER_MISMATCH'),
    );

    await expect(
      controller.syncPortal(
        {
          token: 'x',
          cookies: 'y',
          dateFrom: '2026-07-01',
          dateTo: '2026-07-01',
          type: 'purchase',
        },
        { user: { sub: 'user-1' } },
      ),
    ).rejects.toThrow('GDT_TAXPAYER_MISMATCH');

    expect(notificationsService.createForUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        type: 'ERROR',
        title: 'Không thể đồng bộ hóa đơn từ GDT',
      }),
    );
  });

  it('keeps token expired notification behavior', async () => {
    service.syncFromPortal.mockRejectedValue(new Error('GDT_TOKEN_EXPIRED'));

    await expect(
      controller.syncPortal(
        {
          token: 'x',
          cookies: 'y',
          dateFrom: '2026-07-01',
          dateTo: '2026-07-01',
          type: 'purchase',
        },
        { user: { sub: 'user-2' } },
      ),
    ).rejects.toThrow('GDT_TOKEN_EXPIRED');

    expect(notificationsService.createForUser).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({
        type: 'ERROR',
        title: 'Token GDT hết hạn',
      }),
    );
  });

  it('delegates linkVouchers endpoint to service.linkVouchersToInvoice', async () => {
    const payload = [
      { bankTransactionId: 'txn-1', netOffAmount: 100 },
      { bankTransactionId: 'txn-2', netOffAmount: 50 },
    ];
    service.linkVouchersToInvoice.mockResolvedValue({
      message: 'Đã liên kết phiếu thành công',
    });

    const result = await controller.linkVouchers('inv-1', payload);

    expect(service.linkVouchersToInvoice).toHaveBeenCalledWith(
      'inv-1',
      payload,
    );
    expect(result).toEqual({ message: 'Đã liên kết phiếu thành công' });
  });

  it('delegates removeVoucherLink endpoint to service.removeVoucherFromInvoice', async () => {
    service.removeVoucherFromInvoice.mockResolvedValue({
      message: 'Đã xóa liên kết phiếu thành công',
    });

    const result = await controller.removeVoucherLink('inv-1', 'txn-1');

    expect(service.removeVoucherFromInvoice).toHaveBeenCalledWith(
      'inv-1',
      'txn-1',
    );
    expect(result).toEqual({ message: 'Đã xóa liên kết phiếu thành công' });
  });
});
