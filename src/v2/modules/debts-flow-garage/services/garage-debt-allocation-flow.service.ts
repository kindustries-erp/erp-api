import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { branchWhere } from '@/v2/core/branches-core';
import {
  AbstractDebtFlowService,
  toMoney,
  type DebtSettlementResult,
} from '@/v2/core/debts-core';
import { CashflowVoucherGarageCommandService } from '../../cashflow-vouchers-garage/services/cashflow-voucher-garage-command.service';
import { DebtAllocationGarage } from '../../debts-garage/entities/debt-allocation-garage.entity';
import { DebtGarage } from '../../debts-garage/entities/debt-garage.entity';
import { GarageDebtSettlementService } from '../../debts-garage/services/garage-debt-settlement.service';
import { LegacyKgaraMirrorService } from '../legacy/legacy-kgara-mirror.service';
import type { AllocateDebtDto } from '../dto/allocate-debt.dto';
import {
  GARAGE_DEBTS_FLOW_EVENTS,
  GarageDebtsFlowEventsService,
} from './garage-debts-flow-events.service';

/** Phân bổ thủ công và đảo phân bổ. Mỗi lệnh một transaction; sổ nợ chỉ đổi qua cổng settlement. */
@Injectable()
export class GarageDebtAllocationFlowService extends AbstractDebtFlowService {
  constructor(
    protected readonly dataSource: DataSource,
    protected readonly events: GarageDebtsFlowEventsService,
    private readonly vouchers: CashflowVoucherGarageCommandService,
    private readonly settlement: GarageDebtSettlementService,
    private readonly mirror: LegacyKgaraMirrorService,
  ) {
    super();
  }

  allocate(
    branchId: string | undefined,
    dto: AllocateDebtDto,
    idempotencyKey: string,
    actorId: string | null,
  ): Promise<DebtSettlementResult> {
    return this.runInTransaction(async (manager, emit) => {
      const debt = await manager.getRepository(DebtGarage).findOne({
        where: { id: dto.debtId, ...branchWhere(branchId), isDeleted: false },
      });
      if (!debt) throw new NotFoundException('Không có khoản nợ');

      if (dto.voucherId) {
        const voucher = await this.vouchers.lock(
          manager,
          dto.voucherId,
          branchId,
        );
        if (voucher.status !== 'PAID') {
          throw new ConflictException('Chỉ phân bổ từ phiếu đã thu chi (PAID)');
        }
        const used = await manager
          .getRepository(DebtAllocationGarage)
          .createQueryBuilder('a')
          .select('COALESCE(SUM(a.amount), 0)', 'sum')
          .where('a.voucherId = :id AND a.reversedAt IS NULL', {
            id: dto.voucherId,
          })
          .getRawOne<{ sum: string }>();
        if (
          toMoney(used?.sum) + toMoney(dto.amount) >
          toMoney(voucher.amount)
        ) {
          throw new ConflictException('Tổng phân bổ vượt số tiền của phiếu');
        }
      }

      const result = await this.settlement.apply(manager, {
        debtId: dto.debtId,
        sourceType: dto.sourceType ?? 'MANUAL',
        sourceId: dto.sourceId ?? null,
        amount: dto.amount,
        idempotencyKey,
        voucherId: dto.voucherId ?? null,
        payerType: dto.payerType,
        transDate: dto.transDate ?? null,
        actorId,
        allowOverpay: dto.allowOverpay,
      });
      if (!result.replayed && !dto.voucherId) {
        const row = await manager
          .getRepository(DebtAllocationGarage)
          .findOne({ where: { id: result.allocation.id } });
        if (row) await this.mirror.mirrorManualAllocation(manager, row, debt);
      }
      this.notify(emit, result, debt.caseId);
      return result;
    });
  }

  reverseAllocation(
    branchId: string | undefined,
    allocationId: string,
    idempotencyKey: string,
    actorId: string | null,
  ): Promise<DebtSettlementResult> {
    return this.runInTransaction(async (manager, emit) => {
      const allocation = await manager
        .getRepository(DebtAllocationGarage)
        .findOne({ where: { id: allocationId, ...branchWhere(branchId) } });
      if (!allocation) throw new NotFoundException('Không có phân bổ');
      const debt = await manager
        .getRepository(DebtGarage)
        .findOne({ where: { id: allocation.debtId } });
      const result = await this.settlement.reverse(manager, {
        allocationId,
        idempotencyKey,
        actorId,
      });
      if (!result.replayed && !allocation.voucherId) {
        await this.mirror.unmirrorManualAllocation(
          manager,
          allocation.id,
          debt?.caseId,
        );
      }
      this.notify(emit, result, debt?.caseId);
      return result;
    });
  }

  private notify(
    emit: (e: {
      type: string;
      documentType: string;
      documentId: string;
      payload?: Record<string, unknown>;
    }) => void,
    result: DebtSettlementResult,
    caseId?: string | null,
  ): void {
    if (result.replayed) return;
    emit({
      type: GARAGE_DEBTS_FLOW_EVENTS.allocationChanged,
      documentType: 'DEBT_ALLOCATION_GARAGE',
      documentId: result.allocation.id,
      payload: { caseIds: caseId ? [caseId] : [] },
    });
  }
}
