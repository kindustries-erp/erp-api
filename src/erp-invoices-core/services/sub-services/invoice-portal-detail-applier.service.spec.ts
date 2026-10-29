import { NotFoundException } from '@nestjs/common';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpInvoiceItem } from '../../entities/erp_invoice_item.entity';
import {
  InvoicePortalDetailApplier,
  PortalDetailPayload,
} from './invoice-portal-detail-applier.service';

describe('InvoicePortalDetailApplier', () => {
  let manager: {
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let applier: InvoicePortalDetailApplier;

  const baseInvoice = (): Partial<ErpInvoice> & {
    items: ErpInvoiceItem[];
  } => ({
    id: 'inv-1',
    isDeleted: false,
    invoiceNo: '0000123',
    description: 'Thay dầu động cơ',
    notes: 'ghi chú tay',
    categoryId: 'cat-manual',
    branchIds: ['branch-1'],
    branchId: 'branch-1',
    settlementOrder: null,
    licensePlate: null,
    buyerName: 'Cty cũ',
    totalAmount: '1000.00',
    items: [
      {
        id: 'row-1',
        description: 'Lọc dầu',
        quantity: '1',
        unitPrice: '100',
        itemCode: 'MANUAL-CODE',
        invoiceSubcategory: 'SPECIAL',
      } as ErpInvoiceItem,
    ],
  });

  const payload = (
    overrides: Partial<PortalDetailPayload> = {},
  ): PortalDetailPayload => ({
    header: { buyerName: 'Cty mới', totalAmount: 1000 },
    items: [{ description: 'Lọc dầu', quantity: 2, unit: 'cái' }],
    ...overrides,
  });

  beforeEach(() => {
    manager = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      create: jest.fn((_entity, data) => data),
      save: jest.fn().mockResolvedValue([]),
    };
    dataSource = {
      transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
    };
    applier = new InvoicePortalDetailApplier(dataSource as never);
  });

  it('throws NotFoundException when invoice does not exist', async () => {
    manager.findOne.mockResolvedValue(null);

    await expect(
      applier.applyPortalDetail('missing', payload()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never deletes all items of the invoice and keeps matched row ids', async () => {
    manager.findOne.mockResolvedValue(baseInvoice());

    const result = await applier.applyPortalDetail('inv-1', payload());

    expect(result.changed).toBe(true);
    expect(manager.delete).not.toHaveBeenCalledWith(
      ErpInvoiceItem,
      expect.objectContaining({ invoiceId: 'inv-1' }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      ErpInvoiceItem,
      { id: 'row-1' },
      { quantity: '2', unit: 'cái' },
    );
  });

  it('updates only GDT-owned invoice fields and leaves manual fields alone', async () => {
    manager.findOne.mockResolvedValue(baseInvoice());

    await applier.applyPortalDetail('inv-1', payload());

    const invoiceUpdate = manager.update.mock.calls.find(
      ([entity]) => entity === ErpInvoice,
    );
    expect(invoiceUpdate).toBeDefined();
    const columns = invoiceUpdate![2];
    expect(columns).toEqual({ buyerName: 'Cty mới' });
    expect(columns).not.toHaveProperty('notes');
    expect(columns).not.toHaveProperty('categoryId');
    expect(columns).not.toHaveProperty('branchIds');
  });

  it('keeps manual itemCode and invoiceSubcategory on matched rows', async () => {
    manager.findOne.mockResolvedValue(baseInvoice());

    await applier.applyPortalDetail('inv-1', payload());

    const itemUpdate = manager.update.mock.calls.find(
      ([entity]) => entity === ErpInvoiceItem,
    );
    expect(itemUpdate![2]).not.toHaveProperty('itemCode');
    expect(itemUpdate![2]).not.toHaveProperty('invoiceSubcategory');
  });

  it('fills settlementOrder from description only when it is empty', async () => {
    const invoice = baseInvoice();
    invoice.description = 'Sửa xe 50H-319.73 theo GR-999';
    manager.findOne.mockResolvedValue(invoice);

    await applier.applyPortalDetail('inv-1', payload());

    const invoiceUpdate = manager.update.mock.calls.find(
      ([entity]) => entity === ErpInvoice,
    );
    expect(invoiceUpdate![2]).toMatchObject({
      settlementOrder: 'GR-999',
      licensePlate: '50H-319.73',
    });
  });

  it('does not overwrite an existing settlementOrder', async () => {
    const invoice = baseInvoice();
    invoice.description = 'Sửa xe 50H-319.73 theo GR-999';
    invoice.settlementOrder = 'WO-MANUAL';
    manager.findOne.mockResolvedValue(invoice);

    await applier.applyPortalDetail('inv-1', payload());

    const invoiceUpdate = manager.update.mock.calls.find(
      ([entity]) => entity === ErpInvoice,
    );
    expect(invoiceUpdate![2]).not.toHaveProperty('settlementOrder');
  });

  it('inserts new GDT rows and deletes rows GDT no longer has', async () => {
    manager.findOne.mockResolvedValue(baseInvoice());

    await applier.applyPortalDetail(
      'inv-1',
      payload({
        items: [{ description: 'Dây curoa', quantity: 1, totalAmount: 50000 }],
      }),
    );

    expect(manager.delete).toHaveBeenCalledWith(ErpInvoiceItem, {
      id: expect.anything(),
    });
    expect(manager.save).toHaveBeenCalledWith(ErpInvoiceItem, [
      expect.objectContaining({ invoiceId: 'inv-1', description: 'Dây curoa' }),
    ]);
  });

  it('does nothing and reports unchanged when GDT data equals current data', async () => {
    const invoice = baseInvoice();
    invoice.buyerName = 'Cty mới';
    invoice.totalAmount = '1000.00';
    invoice.licensePlate = '50H-319.73';
    invoice.settlementOrder = 'WO-1';
    invoice.items[0].quantity = '2';
    invoice.items[0].unit = 'cái';
    manager.findOne.mockResolvedValue(invoice);

    const result = await applier.applyPortalDetail('inv-1', payload());

    expect(result.changed).toBe(false);
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });
});
