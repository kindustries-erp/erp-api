import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateKgaraCashflowVoucherDto } from './garage-cashflow.dto';

const errorsOf = async (body: Record<string, unknown>) =>
  (await validate(plainToInstance(UpdateKgaraCashflowVoucherDto, body))).map(
    (e) => e.property,
  );

describe('GarageCashflowQrFieldsDto (qua UpdateKgaraCashflowVoucherDto)', () => {
  it('nhận thông tin thanh toán hợp lệ', async () => {
    expect(
      await errorsOf({
        qrCompanyAccountId: '05666c3f-5897-46f7-b952-39c703e7a6d2',
        qrBankBin: '970418',
        qrBankCode: 'BIDV',
        qrAccountNumber: '1234567890',
        qrAccountName: 'CONG TY ABC',
        qrTransferContent: 'PT-001 51B79071',
      }),
    ).toEqual([]);
  });

  it('cho phép null để xóa và bỏ trống', async () => {
    expect(await errorsOf({ qrBankBin: null, qrAccountNumber: null })).toEqual(
      [],
    );
    expect(await errorsOf({})).toEqual([]);
  });

  it('cắt khoảng trắng và đổi chuỗi rỗng thành null trước khi validate', async () => {
    const dto = plainToInstance(UpdateKgaraCashflowVoucherDto, {
      qrBankBin: ' 970418 ',
      qrAccountNumber: '  1234567890 ',
      qrCompanyAccountId: '',
      qrTransferContent: '   ',
    });
    expect((await validate(dto)).map((e) => e.property)).toEqual([]);
    expect(dto).toMatchObject({
      qrBankBin: '970418',
      qrAccountNumber: '1234567890',
      qrCompanyAccountId: null,
      qrTransferContent: null,
    });
  });

  it('từ chối BIN sai, số TK sai, id không phải UUID, chuỗi quá dài', async () => {
    expect(
      await errorsOf({
        qrCompanyAccountId: 'abc',
        qrBankBin: '97041',
        qrAccountNumber: '123-456',
        qrTransferContent: 'x'.repeat(256),
      }),
    ).toEqual(
      expect.arrayContaining([
        'qrCompanyAccountId',
        'qrBankBin',
        'qrAccountNumber',
        'qrTransferContent',
      ]),
    );
  });
});
