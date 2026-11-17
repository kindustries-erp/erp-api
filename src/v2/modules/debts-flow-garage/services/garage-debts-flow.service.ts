import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { CashflowVoucherStatus } from '@/v2/core/cashflow-vouchers-core';
import { AbstractDebtFlowService } from '@/v2/core/debts-core';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
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
    branchId: string,
    dto: CreateCashflowVoucherGarageDto,
    actorId: string | null,
  ): Promise<CashflowVoucherGarageRow> {
    return this.runInTransaction(async (manager, emit) => {
      const kase = await this.findCase(manager, branchId, dto.caseId);
      const voucher = (await this.vouchers.create(manager, {
        ...dto,
        branchExternalId: branchId,
        licensePlate: dto.licensePlate ?? kase?.bienSoXe ?? null,
        // Mặc định như V1: phiếu thu đã thu, phiếu chi chờ duyệt.
        status:
          dto.status ?? (dto.voucherType === 'RECEIPT' ? 'PAID' : 'PENDING'),
        payerType:
          dto.payerType ??
          (dto.voucherType === 'RECEIPT'
            ? await this.allocations.resolvePayer(manager, branchId, dto.caseId)
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
    branchId: string,
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
      if (dto.caseId) await this.findCase(manager, branchId, dto.caseId);
      await this.allocations.reverseForVoucher(manager, id, actorId);
      const patch = Object.fromEntries(
        Object.entries(dto).filter(([, v]) => v !== undefined),
      );
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
    branchId: string,
    id: string,
    next: CashflowVoucherStatus,
    actorId: string | null,
  ): Promise<CashflowVoucherGarageRow> {
    return this.runInTransaction(async (manager, emit) => {
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

  private async findCase(
    manager: EntityManager,
    branchId: string,
    caseId?: string | null,
  ): Promise<KgaraCase | null> {
    if (!caseId) return null;
    const found = await manager
      .getRepository(KgaraCase)
      .findOne({ where: { id: caseId, branchExternalId: branchId } });
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
