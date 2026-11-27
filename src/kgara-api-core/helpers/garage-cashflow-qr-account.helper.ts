import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

import { ErpBankAccount } from '../../bank-transactions-core/entities/erp_bank_account.entity';
import type { GarageCashflowQrFieldsDto } from '../dto/garage-cashflow-qr.dto';
import {
  pickVoucherQrFields,
  type GarageCashflowQrFields,
} from './garage-cashflow-qr.helper';

export type CompanyAccountQrSource = Pick<
  ErpBankAccount,
  'bankCode' | 'accountNumber' | 'accountName'
>;

/**
 * Ghi đè mã ngân hàng, số tài khoản, tên tài khoản bằng dữ liệu của tài khoản công ty trên server.
 * Giữ `qrBankBin` (server chưa có bảng map BIN) và nội dung chuyển khoản do client gửi.
 */
export function applyCompanyAccountToQrFields(
  fields: GarageCashflowQrFields,
  account: CompanyAccountQrSource,
): GarageCashflowQrFields {
  return {
    ...fields,
    qrBankCode: account.bankCode,
    qrAccountNumber: account.accountNumber,
    qrAccountName: account.accountName,
  };
}

/**
 * Chuẩn hóa thông tin QR khi ghi phiếu. Có `qrCompanyAccountId` thì tài khoản phải tồn tại,
 * đang hoạt động và chưa xóa; không thì từ chối (400).
 */
export async function resolveVoucherQrFields(
  manager: EntityManager,
  dto: GarageCashflowQrFieldsDto,
): Promise<GarageCashflowQrFields> {
  const fields = pickVoucherQrFields(dto);
  const accountId = fields.qrCompanyAccountId;
  if (!accountId) return fields;

  const account = await manager.findOne(ErpBankAccount, {
    where: { id: accountId, isDeleted: false, isActive: true },
  });
  if (!account) {
    throw new BadRequestException(
      'Tài khoản công ty không tồn tại hoặc đã ngừng sử dụng',
    );
  }
  return applyCompanyAccountToQrFields(fields, account);
}
