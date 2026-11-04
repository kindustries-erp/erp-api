import { DataSource } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderLine } from './entities/purchase-order-line.entity';
import { PurchaseOrdersService } from './purchase-orders.service';

/**
 * AC-2: response của API v2 PO giữ đúng hình dạng v1 (camelCase, số dạng chuỗi,
 * supplierName, totalAmount, inventoryStatus, lines), và đúng khuôn { message, data }.
 */
describe('API v2 purchase-orders: hợp đồng response (AC-2)', () => {
  const header = Object.assign(new PurchaseOrder(), {
    id: 'po-1',
    poNo: 'PO-20261104-001',
    supplierId: 'sup-1',
    supplier: { name: 'NCC A' },
    orderDate: new Date('2026-11-04T00:00:00Z'),
    expectedDate: null,
    status: 'CONFIRMED',
    paymentStatus: 'UNPAID',
    remarks: null,
    supplierInvoiceNo: null,
    createdBy: 'user-1',
    isDeleted: false,
    createdAt: new Date('2026-11-04T01:00:00Z'),
    updatedAt: new Date('2026-11-04T01:00:00Z'),
  });
  const lines = [
    Object.assign(new PurchaseOrderLine(), {
      id: 'l1',
      lineNo: 1,
      itemId: null,
      itemCode: 'A',
      itemName: 'Mặt hàng A',
      description: null,
      qtyOrdered: '2.000',
      qtyReceived: '0.000',
      unitPrice: '100.000',
      amount: '200.000',
    }),
  ];

  function setup() {
    const queries = {
      findOne: jest.fn().mockResolvedValue({ header, lines }),
      list: jest.fn().mockResolvedValue({
        items: [{ header, lines }],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        summaries: { totalAmount: 200 },
      }),
    };
    const commands = {
      approve: jest.fn().mockResolvedValue({ id: 'po-1', status: 'APPROVED' }),
    };
    const numbering = {
      nextNo: jest.fn().mockResolvedValue('PO-20261104-002'),
    };
    const dataSource = {
      transaction: (cb: (m: unknown) => Promise<unknown>) => cb({}),
    } as unknown as DataSource;
    const service = new PurchaseOrdersService(
      commands as never,
      queries as never,
      {} as never,
      numbering as never,
      dataSource,
    );
    return { service, queries, commands, numbering };
  }

  it('findOne trả { message, data } với supplierName, totalAmount và số dạng chuỗi', async () => {
    const { service } = setup();
    const result = await service.findOne('po-1');
    expect(result.message).toBe('Lấy thông tin thành công');
    expect(result.data).toMatchObject({
      id: 'po-1',
      poNo: 'PO-20261104-001',
      supplierName: 'NCC A',
      totalAmount: 200,
      inventoryStatus: 'NOT_RECEIVED',
      createdBy: 'user-1',
    });
    expect(result.data.lines[0]).toMatchObject({
      qtyOrdered: '2.000',
      qtyReceived: '0.000',
      unitPrice: '100.000',
      amount: '200.000',
    });
  });

  it('không lộ entity: response không có isDeleted hay quan hệ supplier', async () => {
    const { service } = setup();
    const { data } = await service.findOne('po-1');
    expect(data).not.toHaveProperty('isDeleted');
    expect(data).not.toHaveProperty('supplier');
  });

  it('list trả items đã map cùng summaries và thông tin phân trang', async () => {
    const { service } = setup();
    const result = await service.list({} as never);
    expect(result).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      summaries: { totalAmount: 200 },
    });
    expect(result.items[0]).toMatchObject({ id: 'po-1', totalAmount: 200 });
  });

  it('approve trả message và kết quả trạng thái', async () => {
    const { service } = setup();
    await expect(service.approve('po-1')).resolves.toEqual({
      message: 'Duyệt đơn mua hàng thành công',
      data: { id: 'po-1', status: 'APPROVED' },
    });
  });

  it('next-no dùng tiền tố PO và ngày truyền vào', async () => {
    const { service, numbering } = setup();
    await expect(service.nextNo('2026-11-04')).resolves.toEqual({
      nextNo: 'PO-20261104-002',
    });
    expect(numbering.nextNo).toHaveBeenCalledWith(
      expect.anything(),
      PurchaseOrder,
      'PO',
      '2026-11-04',
    );
  });
});
