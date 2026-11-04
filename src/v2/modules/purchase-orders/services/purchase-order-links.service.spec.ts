import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PURCHASE_ORDER_STATUS } from '@/v2/core/purchase-orders/contracts/purchase-order.contract';
import { PurchaseOrderLinksService } from './purchase-order-links.service';

const PO_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_PO = '22222222-2222-2222-2222-222222222222';
const INV_1 = '33333333-3333-3333-3333-333333333331';
const INV_2 = '33333333-3333-3333-3333-333333333332';

/**
 * Giả lập repository/manager tối thiểu. `po` là bản ghi PO trả về,
 * `invoices` là hóa đơn tìm được trong transaction.
 */
function setup(options: {
  po?: { id: string; status: string } | null;
  invoices?: {
    id: string;
    invoiceNo: string;
    purchaseOrderId: string | null;
  }[];
}) {
  const update = jest.fn().mockResolvedValue({ affected: 1 });
  const find = jest.fn().mockResolvedValue(options.invoices ?? []);
  const manager = { find, update };
  const repo = {
    findOne: jest.fn().mockResolvedValue(options.po ?? null),
    update,
  };
  const dataSource = {
    getRepository: jest.fn(() => repo),
    transaction: (cb: (m: typeof manager) => Promise<unknown>) => cb(manager),
  } as unknown as DataSource;
  return { service: new PurchaseOrderLinksService(dataSource), update, find };
}

describe('PurchaseOrderLinksService.linkInvoices (#6)', () => {
  it('báo lỗi khi PO không tồn tại', async () => {
    const { service } = setup({ po: null });
    await expect(service.linkInvoices(PO_ID, [INV_1])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('từ chối gắn hóa đơn vào PO đã hủy', async () => {
    const { service } = setup({
      po: { id: PO_ID, status: PURCHASE_ORDER_STATUS.CANCELLED },
    });
    await expect(service.linkInvoices(PO_ID, [INV_1])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('từ chối khi có hóa đơn không tồn tại hoặc đã xóa', async () => {
    const { service } = setup({
      po: { id: PO_ID, status: PURCHASE_ORDER_STATUS.CONFIRMED },
      invoices: [{ id: INV_1, invoiceNo: 'HD-1', purchaseOrderId: null }],
    });
    await expect(
      service.linkInvoices(PO_ID, [INV_1, INV_2]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('từ chối khi hóa đơn đang thuộc PO khác', async () => {
    const { service, update } = setup({
      po: { id: PO_ID, status: PURCHASE_ORDER_STATUS.CONFIRMED },
      invoices: [{ id: INV_1, invoiceNo: 'HD-9', purchaseOrderId: OTHER_PO }],
    });
    await expect(service.linkInvoices(PO_ID, [INV_1])).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('gắn thành công, bỏ id trùng trước khi kiểm tra', async () => {
    const { service, update } = setup({
      po: { id: PO_ID, status: PURCHASE_ORDER_STATUS.CONFIRMED },
      invoices: [
        { id: INV_1, invoiceNo: 'HD-1', purchaseOrderId: null },
        { id: INV_2, invoiceNo: 'HD-2', purchaseOrderId: PO_ID },
      ],
    });
    const result = await service.linkInvoices(PO_ID, [INV_1, INV_2, INV_1]);
    expect(result.data.linked).toBe(2);
    expect(update).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      purchaseOrderId: PO_ID,
    });
  });
});

describe('PurchaseOrderLinksService.unlinkInvoice', () => {
  it('báo lỗi khi hóa đơn không thuộc PO', async () => {
    const update = jest.fn().mockResolvedValue({ affected: 0 });
    const dataSource = {
      getRepository: () => ({ update }),
    } as unknown as DataSource;
    const service = new PurchaseOrderLinksService(dataSource);
    await expect(service.unlinkInvoice(PO_ID, INV_1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
