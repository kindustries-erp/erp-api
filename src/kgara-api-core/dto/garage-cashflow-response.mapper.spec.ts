import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import { toKgaraCashflowVoucherResponse } from './garage-cashflow.dto';

const base = (extra: Partial<KgaraCashflowVoucher> = {}) =>
  Object.assign(new KgaraCashflowVoucher(), {
    id: 'v-1',
    voucherCode: 'PT-001',
    voucherType: 'RECEIPT',
    amount: '5000000',
    transDate: '2026-11-26',
    createdAt: new Date('2026-11-26T00:00:00Z'),
    updatedAt: new Date('2026-11-26T00:00:00Z'),
    ...extra,
  }) as KgaraCashflowVoucher;

describe('toKgaraCashflowVoucherResponse - thông tin thanh toán QR', () => {
  it('trả đủ 6 field qr* đã lưu', () => {
    const res = toKgaraCashflowVoucherResponse(
      base({
        qrCompanyAccountId: '11111111-1111-4111-8111-111111111111',
        qrBankBin: '970418',
        qrBankCode: 'BIDV',
        qrAccountNumber: '1240000123456',
        qrAccountName: 'CTY BLUEWAY',
        qrTransferContent: 'PT-001 30A12345',
      }),
    );
    expect(res).toMatchObject({
      qrCompanyAccountId: '11111111-1111-4111-8111-111111111111',
      qrBankBin: '970418',
      qrBankCode: 'BIDV',
      qrAccountNumber: '1240000123456',
      qrAccountName: 'CTY BLUEWAY',
      qrTransferContent: 'PT-001 30A12345',
    });
  });

  it('phiếu chưa lưu QR trả null cho các field qr*', () => {
    const res = toKgaraCashflowVoucherResponse(base());
    expect(res.qrBankBin).toBeNull();
    expect(res.qrAccountNumber).toBeNull();
    expect(res.qrCompanyAccountId).toBeNull();
  });
});
