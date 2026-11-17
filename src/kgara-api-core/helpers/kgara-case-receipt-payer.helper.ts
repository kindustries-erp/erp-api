import type { QueryRunner } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { getCaseReceivableDues } from './kgara-case-dues.helper';
import {
  resolveReceiptPayerType,
  type ReceiptPayerType,
} from './kgara-receipt-payer-resolver.helper';

/**
 * Bên thanh toán của một khoản thu gắn phiếu dịch vụ: explicit nếu có,
 * không thì tự gán theo phần BH còn thiếu của phiếu (đọc phiếu và tổng BH đã thu).
 */
export async function resolveCaseReceiptPayer(
  queryRunner: QueryRunner,
  caseId: string,
  amount: number,
  explicit?: ReceiptPayerType,
  excludeSettlementId?: string,
): Promise<ReceiptPayerType> {
  if (explicit) return explicit;
  const kCase = await queryRunner.manager.findOne(KgaraCase, {
    where: { id: caseId },
    select: ['id', 'tienCoThue', 'rawData'],
  });
  if (!kCase) return 'KH';
  const { dueBH } = getCaseReceivableDues(kCase.rawData, kCase.tienCoThue);
  if (!(dueBH > 0)) return 'KH';
  const rows: Array<{ paid: string | null }> = await queryRunner.query(
    `SELECT COALESCE(SUM(amount), 0) AS paid FROM kgara_case_settlements
       WHERE case_id = $1 AND settlement_type = 'RECEIPT' AND payer_type = 'BH'
         AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [caseId, excludeSettlementId ?? null],
  );
  return resolveReceiptPayerType({
    amount,
    dueBH,
    paidBH: Number(rows[0]?.paid) || 0,
  });
}
