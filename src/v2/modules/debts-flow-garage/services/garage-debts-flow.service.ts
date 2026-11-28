import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { CashflowVoucherStatus } from '@/v2/core/cashflow-vouchers-core';
import { AbstractDebtFlowService } from '@/v2/core/debts-core';
import { assertErpBranchExists, branchWhere } from '@/v2/core/branches-core';
import {
  assertGarageVoucherRules,
  type GarageVoucherRuleState,
} from '@/kgara-api-core/helpers/garage-cashflow-voucher-rules';
import { defaultGaragePartnerName } from '@/kgara-api-core/helpers/garage-cashflow-partner';
import { CaseGarage } from '../../cases-garage/entities/case-garage.entity';
import type { CashflowVoucherGarageRow } from '../../cashflow-vouchers-garage/dto/cashflow-voucher-garage.types';
import type {
  CreateCashflowVoucherGarageDto,
  UpdateCashflowVoucherGarageDto,
} from '../../cashflow-vouchers-garage/dto/create-cashflow-voucher-garage.dto';
import type { CashflowVoucherGarage } from '../../cashflow-vouchers-garage/entities/cashflow-voucher-garage.entity';
import { toCashflowVoucherRow } from '../../cashflow-vouchers-garage/helpers/cashflow-voucher-garage.mapper';
import { CashflowVoucherGarageCommandService } from '../../cashflow-vouchers-garage/services/cashflow-voucher-garage-command.service';
import { LegacyKgaraMirrorService } from '../legacy/legacy-kgara-mirror.service';
import {
  GARAGE_DEBTS_FLOW_EVENTS,
  GarageDebtsFlowEventsService,
} from './garage-debts-flow-events.service';
import { GarageVoucherAllocationService } from './garage-voucher-allocation.service';

/** Phiếu v2 theo hình dạng của luật nhập phiếu dùng chung với v1 (v1 gọi trạng thái là `paymentStatus`). */
const toRuleState = (v: {
  voucherType?: string;
  status?: string | null;
  amount?: number | string;
  paymentMethod?: string | null;
  paymentContent?: string | null;
  caseId?: string | null;
  note?: string | null;
}): GarageVoucherRuleState => ({
  voucherType: v.voucherType,
  paymentStatus: v.status,
  amount: v.amount,
  paymentMethod: v.paymentMethod,
  paymentContent: v.paymentContent,
  caseId: v.caseId,
  note: v.note,
});

/**
 * Orchestrator thu chi garage: mỗi lệnh là MỘT transaction gồm ghi phiếu + áp/đảo phân bổ công nợ.
 * Lỗi ở bước nào thì rollback cả hai. Thứ tự khóa cố định: phiếu rồi tới các khoản nợ (theo id).
 */
@Injectable()
export class GarageDebtsFlowService extends AbstractDebtFlowService {
  constructor(
    protected readonly dataSource: DataSource,
    protected readonly events: GarageDebtsFlowEventsService,
    private readonly vouchers: CashflowVoucherGarageCommandService,
    private readonly allocations: GarageVoucherAllocationService,
    private readonly mirror: LegacyKgaraMirrorService,
  ) {
    super();
  }

  recordVoucher(
    branchId: string | undefined,
    dto: CreateCashflowVoucherGarageDto,
    actorId: string | null,
  ): Promise<CashflowVoucherGarageRow> {
    return this.runInTransaction(async (manager, emit) => {
      // Mặc định như V1: phiếu thu đã thu, phiếu chi chờ duyệt.
      const status =
        dto.status ?? (dto.voucherType === 'RECEIPT' ? 'PAID' : 'PENDING');
      assertGarageVoucherRules(toRuleState({ ...dto, status }));
      const kase = await this.findCase(manager, branchId, dto.caseId);
      if (!kase) await assertErpBranchExists(manager, branchId);
      const voucher = (await this.vouchers.create(manager, {
        ...dto,
        // Chi nhánh ERP theo vụ việc (nếu có), không thì chi nhánh đang chọn; UUID KGara chỉ theo vụ việc.
        branchId: kase?.branchId ?? branchId ?? null,
        branchExternalId: kase?.branchExternalId ?? null,
        licensePlate: dto.licensePlate ?? kase?.licensePlate ?? null,
        partnerName:
          dto.partnerName ||
          defaultGaragePartnerName(dto.voucherType, kase?.customerName) ||
          null,
        status,
        payerType:
          dto.payerType ??
          (dto.voucherType === 'RECEIPT'
            ? await this.allocations.resolvePayer(manager, dto.caseId)
            : 'KH'),
        createdBy: actorId,
        source: 'MANUAL',
      })) as CashflowVoucherGarage;
      await this.allocations.applyForVoucher(manager, voucher, actorId);
      await this.mirror.mirrorVoucher(manager, voucher, { actorId });
      this.notify(emit, voucher.id, [voucher.caseId]);
      return toCashflowVoucherRow(voucher);
    });
  }

  updateVoucher(
    branchId: string | undefined,
    id: string,
    dto: UpdateCashflowVoucherGarageDto,
    actorId: string | null,
  ): Promise<CashflowVoucherGarageRow> {
    return this.runInTransaction(async (manager, emit) => {
      const before = (await this.vouchers.lock(
        manager,
        id,
        branchId,
      )) as CashflowVoucherGarage;
      const oldCaseId = before.caseId;
      const patch = Object.fromEntries(
        Object.entries(dto).filter(([, v]) => v !== undefined),
      );
      assertGarageVoucherRules(
        toRuleState({ ...before, ...patch }),
        toRuleState(before),
      );
      if (dto.caseId) await this.findCase(manager, branchId, dto.caseId);
      await this.allocations.reverseForVoucher(manager, id, actorId);
      const updated = (await this.vouchers.updateActive(
        manager,
        id,
        patch,
        branchId,
      )) as CashflowVoucherGarage;
      await this.allocations.syncForVoucher(manager, updated, actorId);
      await this.mirror.mirrorVoucher(manager, updated, {
        previousCaseId: oldCaseId,
        actorId,
      });
      this.notify(emit, id, [oldCaseId, updated.caseId]);
      return toCashflowVoucherRow(updated);
    });
  }

  /** Duyệt, thu chi (PAID: áp phân bổ) hoặc hủy (CANCELLED: đảo phân bổ). */
  changeVoucherStatus(
    branchId: string | undefined,
    id: string,
    next: CashflowVoucherStatus,
    actorId: string | null,
  ): Promise<CashflowVoucherGarageRow> {
    return this.runInTransaction(async (manager, emit) => {
      const before = (await this.vouchers.lock(
        manager,
        id,
        branchId,
      )) as CashflowVoucherGarage;
      assertGarageVoucherRules(
        toRuleState({ ...before, status: next }),
        toRuleState(before),
      );
      const updated = (await this.vouchers.changeStatus(
        manager,
        id,
        next,
        branchId,
      )) as CashflowVoucherGarage;
      await this.allocations.syncForVoucher(manager, updated, actorId);
      await this.mirror.mirrorVoucher(manager, updated, { actorId });
      this.notify(emit, id, [updated.caseId]);
      return toCashflowVoucherRow(updated);
    });
  }

  /** Vụ việc v2; có chọn chi nhánh ERP thì phải cùng chi nhánh. */
  private async findCase(
    manager: EntityManager,
    branchId: string | undefined,
    caseId?: string | null,
  ): Promise<CaseGarage | null> {
    if (!caseId) return null;
    const found = await manager.getRepository(CaseGarage).findOne({
      where: { id: caseId, ...branchWhere(branchId), isDeleted: false },
    });
    if (!found) throw new NotFoundException('Không có vụ việc trong chi nhánh');
    return found;
  }

  private notify(
    emit: (event: {
      type: string;
      documentType: string;
      documentId: string;
      payload?: Record<string, unknown>;
    }) => void,
    voucherId: string,
    caseIds: Array<string | null | undefined>,
  ): void {
    emit({
      type: GARAGE_DEBTS_FLOW_EVENTS.voucherChanged,
      documentType: 'CASHFLOW_VOUCHER_GARAGE',
      documentId: voucherId,
      payload: { caseIds: caseIds.filter(Boolean) },
    });
  }
}
