import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CashflowForecast } from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import { toLegacyPaymentStatus } from '../compat/legacy-voucher.mapper';
import { buildLegacyVoucherCode } from '../compat/legacy-voucher-write.mapper';

export interface CommissionVoucherInput {
  year: number;
  month: number;
  type: 'HOA_HONG_SALE' | 'HOA_HONG_DV';
  amount: number;
  categoryName: string;
  paymentContent: string;
}

export interface CommissionVoucherResult {
  synced: number;
  created: number;
  updated: number;
  delta: number;
}

interface CommissionRow {
  header: CashflowForecast;
  ext: CashflowGarageForecastExt;
  legacy: string;
}

const CREATED_BY = 'Hệ thống (P&L Auto)';

/**
 * Phiếu dự chi hoa hồng P&L (tự động) trên cashflow_*, thay phần voucher của
 * GarageCommissionSync (hub) và GarageProfitLossService.syncCommissionVouchers.
 * Giữ nguyên quy tắc bản cũ:
 * - Phần đã chi (legacy PAID) được khóa; chỉ tạo phiếu chênh lệch dương (delta).
 * - Phiếu đang chờ (legacy PENDING/APPROVED) được cập nhật theo số tiền mới; không có số tiền thì hủy.
 * - Phiếu tự động được ghi dưới dạng dự chi OUT; PENDING -> DRAFT (chờ duyệt).
 * Phần opex (bảng kgara_operating_expenses) không thuộc phạm vi này.
 * Xóa cùng đợt với route cũ (P6).
 */
@Injectable()
export class GarageCommissionForecastSyncService {
  constructor(private readonly dataSource: DataSource) {}

  async syncCommission(
    input: CommissionVoucherInput,
  ): Promise<CommissionVoucherResult> {
    return this.dataSource.transaction(async (manager) => {
      const result: CommissionVoucherResult = {
        synced: 0,
        created: 0,
        updated: 0,
        delta: 0,
      };
      const { year, month, type, amount, categoryName, paymentContent } = input;

      const rows = await loadCommissionRows(manager, year, month, type);
      const paid = rows.filter((r) => r.legacy === 'PAID');
      const activePending = rows.find(
        (r) => r.legacy === 'PENDING' || r.legacy === 'APPROVED',
      );

      const periodStr = `${String(month).padStart(2, '0')}/${year}`;
      const nextMonthYear = month + 1 > 12 ? year + 1 : year;
      const nextMonth = month + 1 > 12 ? 1 : month + 1;
      const transDate = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-10`;

      if (paid.length > 0) {
        const totalPaid = paid.reduce(
          (sum, r) => sum + (Number(r.header.amount) || 0),
          0,
        );
        const diff = amount - totalPaid;
        if (diff > 0) {
          const note = `Chi hoa hồng ${categoryName} T${periodStr} (phần chênh lệch bổ sung sau khi đã chi ${totalPaid.toLocaleString('vi-VN')} đ)`;
          if (activePending) {
            await updateRow(manager, activePending, {
              amount: diff,
              note,
              transDate,
            });
            result.updated++;
          } else {
            await createRow(manager, {
              year,
              month,
              type,
              categoryName,
              paymentContent,
              transDate,
              note,
              amount: diff,
              anchorId: paid[0].header.id,
            });
            result.created++;
            result.delta++;
          }
          result.synced++;
        } else if (activePending) {
          await cancelRow(manager, activePending);
        }
      } else if (amount > 0) {
        const note = `Chi hoa hồng ${categoryName} T${periodStr} (tính từ P&L)`;
        if (activePending) {
          await updateRow(manager, activePending, { amount, note, transDate });
          result.updated++;
        } else {
          await createRow(manager, {
            year,
            month,
            type,
            categoryName,
            paymentContent,
            transDate,
            note,
            amount,
          });
          result.created++;
        }
        result.synced++;
      } else if (activePending) {
        await cancelRow(manager, activePending);
      }
      return result;
    });
  }
}

async function loadCommissionRows(
  manager: EntityManager,
  year: number,
  month: number,
  type: string,
): Promise<CommissionRow[]> {
  const headers = await manager
    .createQueryBuilder(CashflowForecast, 'f')
    .innerJoin(CashflowGarageForecastExt, 'ext', 'ext.forecastId = f.id')
    .where('f.direction = :direction', { direction: 'OUT' })
    .andWhere('f.isDeleted = false')
    .andWhere('ext.isAutoCommission = true')
    .andWhere('ext.pnlPeriodYear = :year', { year })
    .andWhere('ext.pnlPeriodMonth = :month', { month })
    .andWhere('ext.pnlCommissionType = :type', { type })
    .orderBy('f.createdAt', 'ASC')
    .getMany();
  const result: CommissionRow[] = [];
  for (const header of headers) {
    const ext = await manager.findOneByOrFail(CashflowGarageForecastExt, {
      forecastId: header.id,
    });
    result.push({
      header,
      ext,
      legacy: toLegacyPaymentStatus('OUT', header.status),
    });
  }
  return result;
}

async function updateRow(
  manager: EntityManager,
  row: CommissionRow,
  values: { amount: number; note: string; transDate: string },
): Promise<void> {
  row.header.amount = String(values.amount);
  row.header.note = values.note;
  row.header.plannedDate = values.transDate;
  await manager.save(row.header);
}

async function cancelRow(
  manager: EntityManager,
  row: CommissionRow,
): Promise<void> {
  row.header.status = 'CANCELLED';
  await manager.save(row.header);
}

async function createRow(
  manager: EntityManager,
  p: {
    year: number;
    month: number;
    type: string;
    categoryName: string;
    paymentContent: string;
    transDate: string;
    note: string;
    amount: number;
    anchorId?: string;
  },
): Promise<void> {
  const header = await manager.save(
    manager.create(CashflowForecast, {
      code: buildLegacyVoucherCode(
        'PAYMENT',
        new Date(`${p.transDate}T00:00:00Z`),
      ),
      direction: 'OUT',
      kind: 'COMMISSION',
      source: 'AUTO',
      sourceType: 'PNL_COMMISSION',
      sourceId: null,
      partnerId: null,
      partnerName: p.categoryName,
      branchId: null,
      amount: String(p.amount),
      plannedDate: p.transDate,
      status: 'DRAFT',
      requiresApproval: false,
      note: p.note,
      isDeleted: false,
      createdBy: null,
    }),
  );
  await manager.save(
    manager.create(CashflowGarageForecastExt, {
      forecastId: header.id,
      caseId: null,
      licensePlate: null,
      paymentContent: p.paymentContent,
      isAutoExpected: false,
      isAutoCommission: true,
      pnlPeriodYear: p.year,
      pnlPeriodMonth: p.month,
      pnlCommissionType: p.type,
      pnlCommissionAnchorId: p.anchorId ?? null,
      legacyCreatedBy: CREATED_BY,
      legacyPaymentMethod: null,
    }),
  );
}
