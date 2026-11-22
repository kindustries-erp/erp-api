import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EntityManager, EntityTarget } from 'typeorm';
import {
  CASHFLOW_VOUCHER_TRANSITIONS,
  type CashflowVoucherCodePort,
  type CreateCashflowVoucherInput,
  type UpdateCashflowVoucherInput,
} from '../contracts/cashflow-voucher.contract';
import type {
  BaseCashflowVoucherEntity,
  CashflowVoucherStatus,
} from '../entities/base-cashflow-voucher.entity';

const DRAFT: CashflowVoucherStatus[] = ['EXPECTED', 'PENDING'];

/**
 * Lệnh ghi phiếu thu chi (abstract, không @Injectable). Chỉ ghi dòng phiếu trong `manager`
 * của transaction orchestrator; việc phân bổ vào công nợ do orchestrator lo, không nằm ở đây.
 */
export abstract class AbstractCashflowVoucherCommandService {
  protected abstract readonly voucherTarget: EntityTarget<BaseCashflowVoucherEntity>;
  protected abstract readonly codes: CashflowVoucherCodePort;

  async create(
    manager: EntityManager,
    input: CreateCashflowVoucherInput,
  ): Promise<BaseCashflowVoucherEntity> {
    if (!(input.amount > 0)) {
      throw new BadRequestException('Số tiền phiếu phải lớn hơn 0');
    }
    const repo = manager.getRepository(this.voucherTarget);
    const code =
      input.voucherCode?.trim() ||
      (await this.codes.next(input.voucherType, input.transDate, (c) =>
        repo.exists({ where: { voucherCode: c } as never }),
      ));
    if (
      input.voucherCode &&
      (await repo.exists({ where: { voucherCode: code } as never }))
    ) {
      throw new BadRequestException(`Mã phiếu ${code} đã tồn tại`);
    }
    return repo.save(
      repo.create({
        ...input,
        voucherCode: code,
        amount: input.amount.toFixed(2),
        status: input.status ?? 'PENDING',
        payerType: input.payerType ?? 'KH',
        source: input.source ?? 'MANUAL',
      } as never) as unknown as BaseCashflowVoucherEntity,
    );
  }

  /** Chỉ sửa được khi phiếu còn nháp; phiếu PAID/CANCELLED phải hủy rồi tạo lại. */
  async updateDraft(
    manager: EntityManager,
    id: string,
    patch: UpdateCashflowVoucherInput,
    branchExternalId?: string,
  ): Promise<BaseCashflowVoucherEntity> {
    const row = await this.load(manager, id, branchExternalId);
    if (!DRAFT.includes(row.status)) {
      throw new BadRequestException(`Phiếu ${row.status} không sửa được`);
    }
    return this.applyPatch(manager, row, patch);
  }

  /**
   * Sửa phiếu chưa hủy (kể cả PAID). Người gọi (orchestrator) chịu trách nhiệm đảo và áp lại phân bổ
   * công nợ trong cùng transaction; lõi chỉ ghi dòng phiếu.
   */
  async updateActive(
    manager: EntityManager,
    id: string,
    patch: UpdateCashflowVoucherInput,
    branchExternalId?: string,
  ): Promise<BaseCashflowVoucherEntity> {
    const row = await this.load(manager, id, branchExternalId);
    if (row.status === 'CANCELLED') {
      throw new BadRequestException('Phiếu đã hủy không sửa được');
    }
    return this.applyPatch(manager, row, patch);
  }

  /** Khóa dòng phiếu (`pessimistic_write`); khác chi nhánh coi như không tồn tại. */
  lock(
    manager: EntityManager,
    id: string,
    branchExternalId?: string,
  ): Promise<BaseCashflowVoucherEntity> {
    return this.load(manager, id, branchExternalId);
  }

  private applyPatch(
    manager: EntityManager,
    row: BaseCashflowVoucherEntity,
    patch: UpdateCashflowVoucherInput,
  ): Promise<BaseCashflowVoucherEntity> {
    if (patch.amount !== undefined && !(patch.amount > 0)) {
      throw new BadRequestException('Số tiền phiếu phải lớn hơn 0');
    }
    const { amount, ...rest } = patch;
    Object.assign(row, rest);
    if (amount !== undefined) row.amount = amount.toFixed(2);
    return manager.getRepository(this.voucherTarget).save(row);
  }

  async changeStatus(
    manager: EntityManager,
    id: string,
    next: CashflowVoucherStatus,
    branchExternalId?: string,
  ): Promise<BaseCashflowVoucherEntity> {
    const row = await this.load(manager, id, branchExternalId);
    if (!CASHFLOW_VOUCHER_TRANSITIONS[row.status].includes(next)) {
      throw new BadRequestException(`Không chuyển ${row.status} sang ${next}`);
    }
    row.status = next;
    return manager.getRepository(this.voucherTarget).save(row);
  }

  protected async load(
    manager: EntityManager,
    id: string,
    branchExternalId?: string,
  ): Promise<BaseCashflowVoucherEntity> {
    const qb = manager
      .getRepository(this.voucherTarget)
      .createQueryBuilder('v')
      .setLock('pessimistic_write')
      .where('v.id = :id AND v.isDeleted = false', { id });
    if (branchExternalId) {
      qb.andWhere('v.branchExternalId = :branchExternalId', {
        branchExternalId,
      });
    }
    const row = await qb.getOne();
    if (!row) throw new NotFoundException('Không có phiếu thu chi');
    return row;
  }
}
