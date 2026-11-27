import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

import { ErpBankAccount } from '../../bank-transactions-core/entities/erp_bank_account.entity';
import type { GarageCashflowQrFieldsDto } from '../dto/garage-cashflow-qr.dto';
import {
  applyCompanyAccountToQrFields,
  resolveVoucherQrFields,
} from './garage-cashflow-qr-account.helper';

const ACCOUNT_ID = '05666c3f-5897-46f7-b952-39c703e7a6d2';

const serverAccount = {
  bankCode: 'BIDV',
  accountNumber: '1240000123456',
  accountName: 'CONG TY ABC',
} as ErpBankAccount;

const managerWith = (found: ErpBankAccount | null) => {
  const findOne = jest.fn().mockResolvedValue(found);
  return {
    manager: { findOne } as unknown as EntityManager,
    findOne,
  };
};

describe('applyCompanyAccountToQrFields', () => {
  it('ghi đè mã ngân hàng, số và tên TK bằng dữ liệu server, giữ BIN và nội dung', () => {
    const out = applyCompanyAccountToQrFields(
      {
        qrCompanyAccountId: ACCOUNT_ID,
        qrBankBin: '970418',
        qrBankCode: 'SAI',
        qrAccountNumber: '999',
        qrAccountName: 'SAI',
        qrTransferContent: 'PT-001',
      },
      serverAccount,
    );

    expect(out).toEqual({
      qrCompanyAccountId: ACCOUNT_ID,
      qrBankBin: '970418',
      qrBankCode: 'BIDV',
      qrAccountNumber: '1240000123456',
      qrAccountName: 'CONG TY ABC',
      qrTransferContent: 'PT-001',
    });
  });
});

describe('resolveVoucherQrFields', () => {
  it('không có qrCompanyAccountId thì không tra cứu và trả đúng các khóa đã gửi', async () => {
    const { manager, findOne } = managerWith(null);
    const dto: GarageCashflowQrFieldsDto = {
      qrBankBin: '970418',
      qrAccountNumber: '123',
    };

    const out = await resolveVoucherQrFields(manager, dto);

    expect(findOne).not.toHaveBeenCalled();
    expect(out).toEqual({ qrBankBin: '970418', qrAccountNumber: '123' });
  });

  it('qrCompanyAccountId = null thì coi như không gửi', async () => {
    const { manager, findOne } = managerWith(null);

    const out = await resolveVoucherQrFields(manager, {
      qrCompanyAccountId: null,
    });

    expect(findOne).not.toHaveBeenCalled();
    expect(out).toEqual({ qrCompanyAccountId: null });
  });

  it('tài khoản không tồn tại hoặc đã ngừng dùng thì trả 400', async () => {
    const { manager, findOne } = managerWith(null);

    await expect(
      resolveVoucherQrFields(manager, { qrCompanyAccountId: ACCOUNT_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(findOne).toHaveBeenCalledWith(ErpBankAccount, {
      where: { id: ACCOUNT_ID, isDeleted: false, isActive: true },
    });
  });

  it('tài khoản hợp lệ thì ghi đè các trường từ server', async () => {
    const { manager } = managerWith(serverAccount);

    const out = await resolveVoucherQrFields(manager, {
      qrCompanyAccountId: ACCOUNT_ID,
      qrBankBin: '970418',
      qrAccountNumber: 'SAI',
    });

    expect(out.qrAccountNumber).toBe('1240000123456');
    expect(out.qrBankCode).toBe('BIDV');
    expect(out.qrBankBin).toBe('970418');
  });
});
