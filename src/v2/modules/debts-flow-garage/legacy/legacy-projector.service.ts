import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';

import { CaseGarage } from '@/v2/modules/cases-garage/entities/case-garage.entity';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { KgaraCashflowVoucher } from '@/kgara-api-core/entities/kgara_cashflow_voucher.entity';
import { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import type { GarageLedgerProjectorPort } from '@/kgara-api-core/hub/ledger-projector.port';
import { CashflowVoucherGarage } from '../../cashflow-vouchers-garage/entities/cashflow-voucher-garage.entity';
import { LegacyAllocationSyncService } from './legacy-allocation-sync.service';

/**
 * Chiều V1 → v2: V1 vẫn ghi thu chi/cấn trừ/đồng bộ vụ việc (trong lúc chạy song song), service này chiếu
 * kết quả sang bảng v2 SAU khi V1 commit. Mỗi lệnh một transaction riêng, idempotent theo id.
 * Không đụng phân bổ NATIVE (ghi ở v2, đã có mirror sang V1).
 */
@Injectable()
export class LegacyProjectorService implements GarageLedgerProjectorPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly sync: LegacyAllocationSyncService,
  ) {}

  async projectVoucher(voucherId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const v1 = await manager
        .getRepository(KgaraCashflowVoucher)
        .findOne({ where: { id: voucherId } });
      if (!v1) return;
      await this.upsertVoucher(manager, v1);
      if (v1.caseId) await this.sync.syncCase(manager, v1.caseId);
    });
  }

  async removeVoucher(
    voucherId: string,
    caseId?: string | null,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CashflowVoucherGarage);
      const found = await repo.findOne({ where: { id: voucherId } });
      if (found && found.status !== 'CANCELLED') {
        found.status = 'CANCELLED';
        await repo.save(found);
      }
      if (caseId) await this.sync.syncCase(manager, caseId);
    });
  }

  async projectCase(caseId: string): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.sync.syncCase(manager, caseId),
    );
  }

  /** Chi nhánh từ vụ việc; V1 không có cột chi nhánh nên phiếu không vụ việc dùng biến môi trường. */
  private async branchOf(
    manager: EntityManager,
    caseId?: string | null,
  ): Promise<string> {
    if (caseId) {
      const kCase = await manager
        .getRepository(KgaraCase)
        .findOne({ where: { id: caseId } });
      if (kCase?.branchExternalId) return kCase.branchExternalId;
    }
    const fallback = process.env.GARAGE_DEFAULT_BRANCH_EXTERNAL_ID;
    if (!fallback)
      throw new Error(
        'Không xác định được chi nhánh của phiếu V1 (thiếu vụ việc và GARAGE_DEFAULT_BRANCH_EXTERNAL_ID)',
      );
    return fallback;
  }

  /** Chi nhánh ERP từ vụ việc V2 (`cases_garage` dùng chung id với `kgara_cases`); không có thì null. */
  private async erpBranchOf(
    manager: EntityManager,
    caseId?: string | null,
  ): Promise<string | null> {
    if (!caseId) return null;
    const kase = await manager
      .getRepository(CaseGarage)
      .findOne({ where: { id: caseId } });
    return kase?.branchId ?? null;
  }

  private async upsertVoucher(
    manager: EntityManager,
    v1: KgaraCashflowVoucher,
  ): Promise<void> {
    const repo = manager.getRepository(CashflowVoucherGarage);
    const existing = await repo.findOne({ where: { id: v1.id } });
    const settlement = await manager
      .getRepository(KgaraCaseSettlement)
      .findOne({ where: { cashflowVoucherId: v1.id } });
    await repo.save(
      repo.create({
        ...(existing ?? { source: 'LEGACY' }),
        id: v1.id,
        branchExternalId:
          existing?.branchExternalId ??
          (await this.branchOf(manager, v1.caseId)),
        branchId:
          existing?.branchId ?? (await this.erpBranchOf(manager, v1.caseId)),
        voucherCode: v1.voucherCode,
        voucherType: v1.voucherType,
        status: (v1.paymentStatus ??
          'PENDING') as CashflowVoucherGarage['status'],
        transDate: v1.transDate,
        amount: Number(v1.amount).toFixed(2),
        caseId: v1.caseId ?? null,
        licensePlate: v1.licensePlate ?? null,
        paymentMethod: v1.paymentMethod ?? null,
        paymentContent: v1.paymentContent ?? null,
        partnerName: v1.partnerName ?? null,
        payerType: settlement?.payerType === 'BH' ? 'BH' : 'KH',
        erpBankTransactionId: v1.erpBankTransactionId ?? null,
        erpCashVoucherId: v1.erpCashVoucherId ?? null,
        note: v1.note ?? null,
        createdBy: v1.createdBy ?? null,
        isAutoExpected: !!v1.isAutoExpected,
        isAutoCommission: !!v1.isAutoCommission,
        pnlPeriodYear: v1.pnlPeriodYear ?? null,
        pnlPeriodMonth: v1.pnlPeriodMonth ?? null,
        pnlCommissionType: v1.pnlCommissionType ?? null,
        pnlCommissionAnchorId: v1.pnlCommissionAnchorId ?? null,
      }),
    );
  }
}
