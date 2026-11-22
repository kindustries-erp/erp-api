import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '../entities/garage-goods-receipt-line.entity';
import {
  toGarageGoodsReceiptEntityFields,
  toGarageGoodsReceiptResponse,
} from './garage-goods-receipt.mapper';

describe('GarageGoodsReceipt mapper', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const lineEntity: GarageGoodsReceiptLine = {
    id: 'line-1',
    extraData: {},
    garageGoodsReceiptId: 'id-1',
    lineNo: 1,
    itemCode: 'ITEM-01',
    itemName: 'Bố thắng',
    unit: 'Bộ',
    qtyReceived: '2.000',
    unitCost: '150000.00',
    amount: '300000.00',
    notes: 'Nhập phụ tùng',
    createdAt,
    updatedAt: createdAt,
  };

  const entity: GarageGoodsReceipt = {
    id: 'id-1',
    extraData: {},
    receiptNo: 'GGR-20261103-001',
    receiptDate: new Date('2026-11-03T00:00:00.000Z'),
    supplierId: 'sup-1',
    supplierName: 'Nhà cung cấp Phụ tùng A',
    branchId: 'br-1',
    branchName: 'Chi nhánh Quận 7',
    totalAmount: '300000.00',
    status: 'DRAFT',
    paymentStatus: 'UNPAID',
    remarks: 'Phiếu nhập đầu kỳ',
    createdBy: null,
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
    lines: [lineEntity],
  };

  it('maps the entity to the response DTO without isDeleted', () => {
    expect(toGarageGoodsReceiptResponse(entity)).toEqual({
      id: 'id-1',
      extraData: {},
      receiptNo: 'GGR-20261103-001',
      receiptDate: new Date('2026-11-03T00:00:00.000Z'),
      supplierId: 'sup-1',
      supplierName: 'Nhà cung cấp Phụ tùng A',
      branchId: 'br-1',
      branchName: 'Chi nhánh Quận 7',
      totalAmount: 300000,
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      remarks: 'Phiếu nhập đầu kỳ',
      lines: [
        {
          id: 'line-1',
          extraData: {},
          lineNo: 1,
          itemCode: 'ITEM-01',
          itemName: 'Bố thắng',
          unit: 'Bộ',
          qtyReceived: 2,
          unitCost: 150000,
          amount: 300000,
          notes: 'Nhập phụ tùng',
          createdAt,
        },
      ],
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('converts DTO input to entity fields', () => {
    expect(
      toGarageGoodsReceiptEntityFields({
        receiptNo: 'GGR-20261103-001',
        receiptDate: '2026-11-03T00:00:00.000Z',
        supplierId: 'sup-1',
        supplierName: 'NCC A',
        branchId: 'br-1',
        branchName: 'CN 1',
        totalAmount: 300000,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        remarks: 'Sample',
      }),
    ).toEqual({
      receiptNo: 'GGR-20261103-001',
      receiptDate: new Date('2026-11-03T00:00:00.000Z'),
      supplierId: 'sup-1',
      supplierName: 'NCC A',
      branchId: 'br-1',
      branchName: 'CN 1',
      totalAmount: '300000',
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      remarks: 'Sample',
    });
  });

  it('giữ branchId = null khi bỏ trống chi nhánh (không bị lọc như undefined)', () => {
    const fields = toGarageGoodsReceiptEntityFields({ branchId: null });
    expect(fields).toHaveProperty('branchId', null);
  });

  it('không ghi đè branchId khi DTO không gửi chi nhánh', () => {
    const fields = toGarageGoodsReceiptEntityFields({ remarks: 'x' });
    expect(fields).not.toHaveProperty('branchId');
  });
});
