import { DataSource } from 'typeorm';
import { GarageItemCatalog } from '@/v2/modules/items-garage/items-garage.tokens';
import { GarageProcurementRequestCommandService } from '@/v2/modules/procurement-requests-garage/services/procurement-request-command.service';
import { CreatePrFromInvoiceDto } from '../dto/create-pr-from-invoice.dto';
import { GaragePrFromInvoiceService } from './garage-pr-from-invoice.service';

describe('GaragePrFromInvoiceService', () => {
  const manager = { id: 'tx' };
  const dto: CreatePrFromInvoiceDto = {
    requestDate: '2026-11-12',
    invoiceNo: '0001234',
    sellerName: 'ABC',
    lines: [
      {
        itemName: ' Lọc dầu ',
        qtyRequested: 2,
        estUnitPrice: 150000,
        unit: 'Cái',
      },
      { itemName: 'Công thay', qtyRequested: 1, itemType: 'DV' },
    ],
  };
  let dataSource: { transaction: jest.Mock };
  let items: { ensureItems: jest.Mock };
  let requests: { createDraft: jest.Mock };
  let service: GaragePrFromInvoiceService;

  beforeEach(() => {
    dataSource = {
      transaction: jest.fn((work: (m: unknown) => unknown) => work(manager)),
    };
    items = {
      ensureItems: jest.fn().mockResolvedValue({
        items: [
          { id: 'i1', itemCode: 'PT-90915', itemType: 'PT' },
          { id: 'i2', itemCode: 'DV-000001', itemType: 'DV' },
        ],
        created: [{ id: 'i2', itemCode: 'DV-000001', itemName: 'Công thay' }],
      }),
    };
    requests = {
      createDraft: jest
        .fn()
        .mockResolvedValue({ id: 'r1', requestNo: 'GDNM-20261112-001' }),
    };
    service = new GaragePrFromInvoiceService(
      dataSource as unknown as DataSource,
      items as unknown as GarageItemCatalog,
      requests as unknown as GarageProcurementRequestCommandService,
    );
  });

  it('tạo mã thiếu và PR nháp trong cùng một transaction', async () => {
    const result = await service.create(dto, 'u1');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(items.ensureItems).toHaveBeenCalledWith(dto.lines, manager, {
      source: 'AI',
    });
    const [actor, header, lines, usedManager] =
      requests.createDraft.mock.calls[0];
    expect(usedManager).toBe(manager);
    expect(actor).toEqual({ id: 'u1', roles: [] });
    expect(header).toMatchObject({
      requestDate: '2026-11-12',
      title: 'Đề nghị mua theo hóa đơn 0001234',
      extraData: {
        source: 'AI_INVOICE',
        invoiceNo: '0001234',
        sellerName: 'ABC',
      },
    });
    expect(lines).toEqual([
      {
        lineType: 'GOODS',
        itemId: 'i1',
        itemCode: 'PT-90915',
        itemName: 'Lọc dầu',
        qtyRequested: 2,
        estUnitPrice: 150000,
        extraData: { unit: 'Cái' },
      },
      {
        lineType: 'SERVICE',
        itemId: 'i2',
        itemCode: 'DV-000001',
        itemName: 'Công thay',
        qtyRequested: 1,
        estUnitPrice: null,
        extraData: {},
      },
    ]);
    expect(result).toEqual({
      requestId: 'r1',
      requestNo: 'GDNM-20261112-001',
      createdItems: [
        { id: 'i2', itemCode: 'DV-000001', itemName: 'Công thay' },
      ],
    });
  });

  it('giữ tiêu đề người dùng nhập', async () => {
    await service.create({ ...dto, title: ' Mua phụ tùng ' }, 'u1');
    expect(requests.createDraft.mock.calls[0][1].title).toBe('Mua phụ tùng');
  });

  it('lỗi khi tạo phiếu thì ném ra để transaction hoàn tác cả mã mới', async () => {
    requests.createDraft.mockRejectedValue(new Error('số phiếu trùng'));

    await expect(service.create(dto, 'u1')).rejects.toThrow('số phiếu trùng');
  });
});
