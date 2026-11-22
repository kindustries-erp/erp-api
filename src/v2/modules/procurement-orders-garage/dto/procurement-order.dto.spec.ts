import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProcurementOrderDto } from './procurement-order.dto';

const baseLine = {
  lineType: 'GOODS',
  itemCode: 'A1',
  itemName: 'Lốp',
  qtyOrdered: 1,
  unitPrice: 10,
};

const build = (extra: Record<string, unknown>) =>
  plainToInstance(CreateProcurementOrderDto, {
    orderDate: '2026-11-05',
    lines: [baseLine],
    ...extra,
  });

describe('CreateProcurementOrderDto - supplierInvoiceNo', () => {
  it('nhận số hóa đơn NCC hợp lệ', async () => {
    const errors = await validate(build({ supplierInvoiceNo: 'HD-0001' }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors).toHaveLength(0);
  });

  it('từ chối số hóa đơn dài quá 100 ký tự', async () => {
    const errors = await validate(
      build({ supplierInvoiceNo: 'x'.repeat(101) }),
    );
    expect(errors.map((e) => e.property)).toContain('supplierInvoiceNo');
  });
});
