import { pickVoucherQrFields } from './garage-cashflow-qr.helper';

describe('pickVoucherQrFields', () => {
  it('chỉ lấy khóa QR có gửi, cắt khoảng trắng', () => {
    expect(
      pickVoucherQrFields({
        qrBankBin: '970418',
        qrAccountNumber: ' 1234567890 ',
        qrAccountName: 'CONG TY ABC',
      }),
    ).toEqual({
      qrBankBin: '970418',
      qrAccountNumber: '1234567890',
      qrAccountName: 'CONG TY ABC',
    });
  });

  it('chuỗi rỗng và null thành null; không gửi thì bỏ qua', () => {
    expect(
      pickVoucherQrFields({ qrTransferContent: '   ', qrBankCode: null }),
    ).toEqual({ qrTransferContent: null, qrBankCode: null });
    expect(pickVoucherQrFields({})).toEqual({});
  });

  it('bỏ qua field không thuộc nhóm QR', () => {
    const dto = { qrBankBin: '970418', amount: 100 } as never;
    expect(pickVoucherQrFields(dto)).toEqual({ qrBankBin: '970418' });
  });
});
