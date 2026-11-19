import type { CaseGarage } from '../entities/case-garage.entity';
import { toCaseListItem } from './case-list-item.mapper';

const header = (over: Record<string, unknown> = {}) =>
  ({
    id: 'c1',
    origin: 'KGARA_SYNC',
    caseCode: 'PS1',
    branchExternalId: 'b1',
    accountKey: 'MAIN',
    licensePlate: '51A',
    chassisNumber: 'VIN1',
    vehicleBrandCode: 'VF',
    payerCode: 'BH1',
    status: 'COMPLETED',
    totalAmountWithTax: '1000.00',
    paidAmount: '200.00',
    classificationManuallyCleared: false,
    excludeFromReports: false,
    excludeFromDebt: false,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    extraData: {},
    ...over,
  }) as unknown as CaseGarage;

describe('toCaseListItem', () => {
  it('trả trường xe, payer và origin bằng tên EN; không rawData/services', () => {
    const item = toCaseListItem(header());
    expect(item).toMatchObject({
      origin: 'KGARA_SYNC',
      licensePlate: '51A',
      chassisNumber: 'VIN1',
      vehicleBrandCode: 'VF',
      payerCode: 'BH1',
      vehicleModelName: null,
      manufactureYear: null,
    });
    expect(item).not.toHaveProperty('rawData');
    expect(item).not.toHaveProperty('services');
  });

  it('không có cấn trừ: dùng số đã thu lưu, còn lại kẹp ở 0', () => {
    expect(toCaseListItem(header())).toMatchObject({
      paidAmount: 200,
      outstandingAmount: 800,
    });
    expect(toCaseListItem(header({ paidAmount: '1500.00' }))).toMatchObject({
      outstandingAmount: 0,
    });
  });

  it('có RECEIPT thì lấy RECEIPT; chỉ PAYMENT thì giữ số đã lưu', () => {
    const withReceipt = toCaseListItem(header(), {
      settlement: { receipts: 600, payments: 50, hasReceipt: true },
    });
    expect(withReceipt).toMatchObject({
      paidAmount: 600,
      outstandingAmount: 400,
      paidOutAmount: 50,
    });
    const onlyPayment = toCaseListItem(header(), {
      settlement: { receipts: 0, payments: 50, hasReceipt: false },
    });
    expect(onlyPayment.paidAmount).toBe(200);
  });

  it('lãi gộp làm dự phòng; margin; category.code thay classification', () => {
    const item = toCaseListItem(header({ classification: 'OJ' }), {
      grossProfit: { revenue: '1000', cost: '400', profit: null },
      category: { id: 'k1', code: 'SC', name: 'Sửa chữa' },
      links: { total: 3, outCount: 2, inCount: 1 },
    });
    expect(item).toMatchObject({
      revenue: 1000,
      cost: 400,
      profit: 600,
      margin: 60,
      classification: 'SC',
      linkedInvoiceCount: 3,
    });
    expect(toCaseListItem(header()).margin).toBeNull();
  });
});
