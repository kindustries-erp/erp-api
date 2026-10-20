import { EntityManager } from 'typeorm';
import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import { KgaraOperatingExpense } from '../entities/kgara_operating_expense.entity';
import {
  getOpexCategoryForContent,
  isRecordedToOpex,
} from './garage-cashflow-payment-rules';

/**
 * Đồng bộ dòng garage-opex (nhóm Giá vốn) từ phiếu chi 4. HHBH / 8. Vật tư tiêu hao.
 * Phiếu đủ điều kiện thì upsert theo `source_cashflow_voucher_id`, ngược lại gỡ dòng cũ.
 * Chạy trong transaction của phiếu.
 */
export async function syncOpexFromVoucher(
  manager: EntityManager,
  voucher: KgaraCashflowVoucher,
): Promise<void> {
  const existing = await manager.findOne(KgaraOperatingExpense, {
    where: { sourceCashflowVoucherId: voucher.id },
  });

  const category = isRecordedToOpex(voucher)
    ? getOpexCategoryForContent(voucher.paymentContent)
    : null;

  if (!category) {
    if (existing) await manager.remove(existing);
    return;
  }

  const [year, month] = String(voucher.transDate)
    .slice(0, 7)
    .split('-')
    .map(Number);
  const row =
    existing ??
    manager.create(KgaraOperatingExpense, {
      sourceCashflowVoucherId: voucher.id,
      ojAmount: 0,
    });

  row.periodYear = year;
  row.periodMonth = month;
  row.categoryKey = category.categoryKey;
  row.categoryName = category.categoryName;
  row.amount = Number(voucher.amount) || 0;
  row.note = `Từ phiếu chi ${voucher.voucherCode} (${voucher.paymentContent})`;
  await manager.save(row);
}

export async function removeOpexForVoucher(
  manager: EntityManager,
  voucherId: string,
): Promise<void> {
  await manager.delete(KgaraOperatingExpense, {
    sourceCashflowVoucherId: voucherId,
  });
}
