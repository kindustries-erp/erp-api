import { Repository } from 'typeorm';

import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';

/** Một phiếu thu/chi xưởng trong kỳ, đã chuẩn hóa để ghi ra Excel. */
export interface PeriodVoucherRow {
  voucherCode: string;
  transDate: string;
  type: 'RECEIPT' | 'PAYMENT';
  /** Trạng thái: duyệt/chi của phiếu chi; EXPECTED/CANCELLED của phiếu thu dự kiến. */
  paymentStatus?:
    | 'PENDING'
    | 'APPROVED'
    | 'PAID'
    | 'EXPECTED'
    | 'CANCELLED'
    | null;
  paymentContent: string;
  partnerName: string;
  licensePlate: string;
  soChungTu: string;
  paymentMethod: string;
  note: string;
  amount: number;
}

const toDay = (value?: string) => (value ? value.slice(0, 10) : undefined);

/**
 * Phiếu thu/chi theo `trans_date` trong kỳ. Bảng không có cột chi nhánh nên
 * lọc qua phiếu dịch vụ: phiếu không gắn phiếu dịch vụ luôn được giữ.
 */
export async function loadPeriodVoucherRows(
  repo: Repository<KgaraCashflowVoucher>,
  from?: string,
  to?: string,
  branchId?: string,
): Promise<PeriodVoucherRow[]> {
  const qb = repo
    .createQueryBuilder('voucher')
    .leftJoinAndSelect('voucher.case', 'c');

  const dayFrom = toDay(from);
  const dayTo = toDay(to);
  if (dayFrom) qb.andWhere('voucher.transDate >= :dayFrom', { dayFrom });
  if (dayTo) qb.andWhere('voucher.transDate <= :dayTo', { dayTo });
  if (branchId) {
    qb.andWhere(
      '(voucher.caseId IS NULL OR c.branchExternalId = :branchId OR c.branchExternalId IS NULL)',
      { branchId },
    );
  }

  const vouchers = await qb
    .orderBy('voucher.transDate', 'ASC')
    .addOrderBy('voucher.createdAt', 'ASC')
    .getMany();

  return vouchers.map((v) => ({
    voucherCode: v.voucherCode,
    transDate: String(v.transDate ?? '').slice(0, 10),
    type: v.voucherType === 'PAYMENT' ? 'PAYMENT' : 'RECEIPT',
    // Giữ trạng thái cho cả phiếu thu (EXPECTED/CANCELLED) để nhóm dòng tiền phân loại đúng
    paymentStatus: v.paymentStatus ?? null,
    paymentContent: v.paymentContent ?? '',
    partnerName: v.partnerName ?? '',
    licensePlate: v.licensePlate || v.case?.bienSoXe || '',
    soChungTu: v.case?.soChungTu ?? '',
    paymentMethod: v.paymentMethod ?? '',
    note: v.note ?? '',
    amount: Number(v.amount) || 0,
  }));
}
