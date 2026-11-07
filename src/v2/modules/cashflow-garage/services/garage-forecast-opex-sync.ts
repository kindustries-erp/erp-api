import { EntityManager } from 'typeorm';
import {
  removeOpexForVoucher,
  syncOpexFromVoucher,
  type OpexSourceVoucher,
} from '@/kgara-api-core/helpers/garage-cashflow-opex-sync.helper';
import type { CashflowForecast } from '@/v2/core/cashflow-core';
import type { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import { toLegacyPaymentStatus } from '../compat/legacy-voucher.mapper';
import {
  voucherTypeOf,
  type ForecastDirection,
} from '../compat/legacy-voucher-write.mapper';

/**
 * Đồng bộ opex (4. HHBH, 8/10. Vật tư tiêu hao) từ dự chi mới, dùng lại helper của bản cũ.
 * id dự chi = id phiếu cũ (backfill giữ nguyên), nên dòng opex cũ vẫn khớp.
 */
export async function syncOpexForForecast(
  manager: EntityManager,
  header: CashflowForecast,
  ext: CashflowGarageForecastExt | null,
): Promise<void> {
  const direction = header.direction as ForecastDirection;
  const source: OpexSourceVoucher = {
    id: header.id,
    voucherCode: header.code,
    voucherType: voucherTypeOf(direction),
    paymentStatus: toLegacyPaymentStatus(direction, header.status),
    paymentContent: ext?.paymentContent ?? null,
    transDate: header.plannedDate ?? '',
    amount: header.amount,
  } as unknown as OpexSourceVoucher;
  await syncOpexFromVoucher(manager, source);
}

export async function removeOpexForForecast(
  manager: EntityManager,
  forecastId: string,
): Promise<void> {
  await removeOpexForVoucher(manager, forecastId);
}
