import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import type {
  CreateKgaraCashflowVoucherDto,
  UpdateKgaraCashflowVoucherDto,
} from '@/kgara-api-core/dto/garage-cashflow.dto';
import { shouldHaveSettlement } from '@/kgara-api-core/helpers/garage-cashflow-payment-rules';
import { extractNetPayableAmount } from '@/kgara-api-core/utils/kgara-parser.util';
import { CashflowAllocation, CashflowForecast } from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import { toLegacyPaymentStatus } from './legacy-voucher.mapper';
import { GarageCaseReceivableSyncService } from '../services/garage-case-receivable-sync.service';
import {
  removeOpexForForecast,
  syncOpexForForecast,
} from '../services/garage-forecast-opex-sync';
import {
  buildLegacyVoucherCode,
  type LegacyPaymentStatus,
  directionOf,
  needsPayment,
  toForecastStatus,
  toPaymentChannel,
  voucherTypeOf,
  type ForecastDirection,
  type PaymentChannel,
} from './legacy-voucher-write.mapper';

export interface LegacyVoucherWriteActor {
  sub?: string;
  email?: string;
}

export interface LegacyVoucherWriteResult {
  id: string;
  code: string;
}

interface ActivePayment {
  id: string;
  bankTransactionId: string | null;
}

interface AllocationRow {
  direction: ForecastDirection;
  status: string;
  paymentContent: string | null;
  debtCounted: boolean;
  amount: string;
}

const BANK_LINK_BLOCK_MESSAGE =
  'Không thể xóa phiếu thu/chi đã được đồng bộ với sao kê ngân hàng hoặc sổ quỹ ERP. Vui lòng gỡ liên kết trước.';
const PAID_PAYMENT_LOCK_MESSAGE =
  'Phiếu chi đã ở trạng thái Đã chi, không thể cập nhật lại trạng thái thanh toán.';
const PAID_PAYMENT_TYPE_LOCK_MESSAGE =
  'Phiếu chi đã ở trạng thái Đã chi, không thể đổi loại phiếu.';
const HAS_PAYMENT_TYPE_CHANGE_MESSAGE =
  'Phiếu đã có thực thu/chi, không thể đổi loại phiếu.';

/**
 * Ghi phiếu thu chi garage theo hình dạng cũ, vào bảng mới (cashflow_*).
 * - Phiếu đã thu/chi (PAID): tạo thực thu/chi và phân bổ trong cùng transaction.
 * - Phiếu chưa thu/chi: chỉ có dự thu/dự chi, không có thực thu/chi.
 * - Xóa mềm forecast; thực thu/chi đi kèm được hủy (CANCELLED).
 * - Sau mỗi thay đổi, công nợ phiếu dịch vụ được tính lại từ cashflow_allocations.
 *
 * Chưa gồm: hub/opex, dự thu tự động từ phiếu dịch vụ và hoa hồng (task 2.7).
 * Chưa lưu erpCashVoucherId (chưa có cột tương ứng, xem plan mục open decisions).
 * Xóa cùng đợt với route cũ (P6).
 */
@Injectable()
export class LegacyVoucherWriteService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly receivables: GarageCaseReceivableSyncService,
  ) {}

  async createVoucher(
    dto: CreateKgaraCashflowVoucherDto,
    actor: LegacyVoucherWriteActor = {},
  ): Promise<LegacyVoucherWriteResult> {
    const result = await this.dataSource.transaction(async (manager) => {
      const now = new Date();
      const direction = directionOf(dto.voucherType);
      const legacyStatus = (dto.paymentStatus ??
        (dto.voucherType === 'RECEIPT'
          ? 'PAID'
          : 'PENDING')) as LegacyPaymentStatus;
      const caseRef = await this.loadCase(manager, dto.caseId);
      const transDate = dto.transDate || now.toISOString().slice(0, 10);
      const code =
        dto.voucherCode || buildLegacyVoucherCode(dto.voucherType, now);

      const header = await manager.save(
        manager.create(CashflowForecast, {
          code,
          direction,
          kind: dto.caseId ? 'CASE_RECEIVABLE' : 'OTHER',
          source: 'MANUAL',
          sourceType: null,
          sourceId: null,
          partnerId: null,
          partnerName: dto.partnerName || caseRef?.khachHangName || null,
          branchId: null,
          amount: String(dto.amount),
          plannedDate: transDate,
          status: toForecastStatus(direction, legacyStatus),
          requiresApproval: false,
          note: dto.note || null,
          isDeleted: false,
          createdBy: actor.sub ?? null,
        }),
      );

      const ext = await manager.save(
        manager.create(CashflowGarageForecastExt, {
          forecastId: header.id,
          caseId: dto.caseId ?? null,
          licensePlate: dto.licensePlate || caseRef?.bienSoXe || null,
          paymentContent: dto.paymentContent || null,
          isAutoExpected: false,
          isAutoCommission: false,
          legacyCreatedBy: actor.email || actor.sub || 'Hệ thống',
          legacyPaymentMethod: dto.paymentMethod || null,
        }),
      );

      if (needsPayment(legacyStatus)) {
        await this.insertPaymentAndAllocation(manager, header, {
          transDate,
          channel: toPaymentChannel(dto.paymentMethod),
          bankTransactionId: dto.erpBankTransactionId || null,
          actorId: actor.sub ?? null,
        });
      }

      await syncOpexForForecast(manager, header, ext);
      if (dto.caseId) await this.recalcCaseDebt(manager, dto.caseId);
      return { id: header.id, code: header.code };
    });
    await this.receivables.syncCaseReceipts([dto.caseId]);
    return result;
  }

  async updateVoucher(
    id: string,
    dto: UpdateKgaraCashflowVoucherDto,
    actor: LegacyVoucherWriteActor = {},
  ): Promise<LegacyVoucherWriteResult> {
    const result = await this.dataSource.transaction(async (manager) => {
      const { header, ext } = await this.loadLegacyForecast(manager, id);
      const oldCaseId = ext.caseId;
      const oldType = voucherTypeOf(header.direction as ForecastDirection);
      const oldLegacy = toLegacyPaymentStatus(
        header.direction as ForecastDirection,
        header.status,
      ) as LegacyPaymentStatus;
      const active = await this.findActivePayments(manager, header.id);

      if (oldType === 'PAYMENT' && oldLegacy === 'PAID') {
        if (dto.paymentStatus !== undefined && dto.paymentStatus !== 'PAID') {
          throw new BadRequestException(PAID_PAYMENT_LOCK_MESSAGE);
        }
        if (dto.voucherType !== undefined && dto.voucherType !== 'PAYMENT') {
          throw new BadRequestException(PAID_PAYMENT_TYPE_LOCK_MESSAGE);
        }
      }

      const newType = dto.voucherType ?? oldType;
      const newDirection = directionOf(newType);
      const directionChanged = newDirection !== header.direction;
      if (directionChanged && active.length > 0) {
        throw new BadRequestException(HAS_PAYMENT_TYPE_CHANGE_MESSAGE);
      }

      const newLegacy = (dto.paymentStatus ??
        (directionChanged
          ? newType === 'PAYMENT'
            ? 'PENDING'
            : 'EXPECTED'
          : oldLegacy)) as LegacyPaymentStatus;
      const newStatus = toForecastStatus(newDirection, newLegacy);

      const newCaseId = dto.caseId !== undefined ? dto.caseId : ext.caseId;
      const caseChanged = newCaseId !== oldCaseId;
      const caseRef =
        newCaseId && (caseChanged || dto.licensePlate === undefined)
          ? await this.loadCase(manager, newCaseId)
          : null;

      header.direction = newDirection;
      header.amount =
        dto.amount !== undefined ? String(dto.amount) : header.amount;
      header.plannedDate = dto.transDate ?? header.plannedDate;
      header.partnerName = dto.partnerName ?? header.partnerName;
      header.note = dto.note ?? header.note;
      header.status = newStatus;
      await manager.save(header);

      ext.caseId = newCaseId ?? null;
      if (dto.paymentContent !== undefined) {
        ext.paymentContent = dto.paymentContent || null;
      }
      if (dto.licensePlate !== undefined) {
        ext.licensePlate = dto.licensePlate || null;
      } else if (caseRef && (!ext.licensePlate || caseChanged)) {
        ext.licensePlate = caseRef.bienSoXe ?? ext.licensePlate;
      }
      if (dto.paymentMethod !== undefined) {
        ext.legacyPaymentMethod = dto.paymentMethod || null;
      }
      await manager.save(ext);

      if (newStatus === 'SETTLED') {
        if (active.length > 0) {
          await this.updatePayment(manager, header, active[0], {
            transDate:
              header.plannedDate ?? new Date().toISOString().slice(0, 10),
            channel:
              dto.paymentMethod !== undefined
                ? toPaymentChannel(dto.paymentMethod)
                : undefined,
            bankTransactionId: dto.erpBankTransactionId,
          });
          const extra = active.slice(1).map((p) => p.id);
          if (extra.length > 0) await this.cancelPayments(manager, extra);
        } else {
          await this.insertPaymentAndAllocation(manager, header, {
            transDate:
              header.plannedDate ?? new Date().toISOString().slice(0, 10),
            channel: toPaymentChannel(dto.paymentMethod),
            bankTransactionId: dto.erpBankTransactionId || null,
            actorId: actor.sub ?? null,
          });
        }
      } else if (active.length > 0) {
        await this.cancelPayments(
          manager,
          active.map((p) => p.id),
        );
      }

      await syncOpexForForecast(manager, header, ext);
      if (oldCaseId && oldCaseId !== newCaseId) {
        await this.recalcCaseDebt(manager, oldCaseId);
      }
      if (newCaseId) await this.recalcCaseDebt(manager, newCaseId);
      return {
        id: header.id,
        code: header.code,
        caseIds: [oldCaseId, newCaseId],
      };
    });
    await this.receivables.syncCaseReceipts(result.caseIds);
    return { id: result.id, code: result.code };
  }

  async deleteVoucher(id: string): Promise<void> {
    const caseId = await this.dataSource.transaction(async (manager) => {
      const { header, ext } = await this.loadLegacyForecast(manager, id);
      const active = await this.findActivePayments(manager, header.id);
      if (active.some((p) => p.bankTransactionId)) {
        throw new BadRequestException(BANK_LINK_BLOCK_MESSAGE);
      }
      if (active.length > 0) {
        await this.cancelPayments(
          manager,
          active.map((p) => p.id),
        );
      }
      header.isDeleted = true;
      await manager.save(header);
      await removeOpexForForecast(manager, header.id);
      if (ext.caseId) await this.recalcCaseDebt(manager, ext.caseId);
      return ext.caseId;
    });
    await this.receivables.syncCaseReceipts([caseId]);
  }

  private async loadLegacyForecast(
    manager: EntityManager,
    id: string,
  ): Promise<{ header: CashflowForecast; ext: CashflowGarageForecastExt }> {
    const header = await manager.findOne(CashflowForecast, {
      where: { id, isDeleted: false },
    });
    const ext = header
      ? await manager.findOne(CashflowGarageForecastExt, {
          where: { forecastId: id },
        })
      : null;
    if (!header || !ext || header.sourceType === 'LEGACY_PR') {
      throw new NotFoundException(`Voucher ${id} not found`);
    }
    return { header, ext };
  }

  private async loadCase(
    manager: EntityManager,
    caseId?: string | null,
  ): Promise<KgaraCase | null> {
    if (!caseId) return null;
    const kCase = await manager.findOne(KgaraCase, { where: { id: caseId } });
    if (!kCase) throw new NotFoundException(`Case ${caseId} not found`);
    return kCase;
  }

  private async findActivePayments(
    manager: EntityManager,
    forecastId: string,
  ): Promise<ActivePayment[]> {
    const rows: Array<{ id: string; bankTransactionId: string | null }> =
      await manager.query(
        `SELECT p.id, p.bank_transaction_id AS "bankTransactionId"
           FROM cashflow_allocations a
           JOIN cashflow_payments p ON p.id = a.payment_id
          WHERE a.forecast_id = $1 AND p.status = 'POSTED' AND p.is_deleted = false`,
        [forecastId],
      );
    return rows;
  }

  private async insertPaymentAndAllocation(
    manager: EntityManager,
    header: CashflowForecast,
    opts: {
      transDate: string;
      channel: PaymentChannel;
      bankTransactionId: string | null;
      actorId: string | null;
    },
  ): Promise<void> {
    const direction: ForecastDirection = header.direction as ForecastDirection;
    const rows: Array<{ id: string }> = await manager.query(
      `INSERT INTO cashflow_payments
         (code, direction, amount, trans_date, channel, bank_transaction_id, partner_name, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        `TT-${randomUUID()}`,
        direction,
        header.amount,
        opts.transDate,
        opts.channel,
        opts.bankTransactionId,
        header.partnerName,
        header.note,
        opts.actorId,
      ],
    );
    await manager.save(
      manager.create(CashflowAllocation, {
        paymentId: rows[0].id,
        forecastId: header.id,
        amount: header.amount,
        createdBy: opts.actorId,
      }),
    );
  }

  private async updatePayment(
    manager: EntityManager,
    header: CashflowForecast,
    payment: ActivePayment,
    opts: {
      transDate: string;
      channel?: PaymentChannel;
      bankTransactionId?: string | null;
    },
  ): Promise<void> {
    await manager.query(
      `UPDATE cashflow_payments
          SET amount = $2,
              trans_date = $3,
              channel = COALESCE($4, channel),
              bank_transaction_id = COALESCE($5, bank_transaction_id),
              partner_name = $6,
              note = $7,
              updated_at = now()
        WHERE id = $1`,
      [
        payment.id,
        header.amount,
        opts.transDate,
        opts.channel ?? null,
        opts.bankTransactionId ?? null,
        header.partnerName,
        header.note,
      ],
    );
    await manager.query(
      `UPDATE cashflow_allocations SET amount = $2 WHERE payment_id = $1 AND forecast_id = $3`,
      [payment.id, header.amount, header.id],
    );
  }

  private async cancelPayments(
    manager: EntityManager,
    paymentIds: string[],
  ): Promise<void> {
    await manager.query(
      `DELETE FROM cashflow_allocations WHERE payment_id = ANY($1::uuid[])`,
      [paymentIds],
    );
    await manager.query(
      `UPDATE cashflow_payments SET status = 'CANCELLED', updated_at = now() WHERE id = ANY($1::uuid[])`,
      [paymentIds],
    );
  }

  /**
   * Tính lại công nợ phiếu dịch vụ từ cashflow_allocations (thực thu IN, phiếu và thực thu còn hiệu lực).
   * Không có phân bổ nào thì dùng số đã thanh toán gốc (rawData), như bản cũ.
   */
  private async recalcCaseDebt(
    manager: EntityManager,
    caseId: string,
  ): Promise<void> {
    const kCase = await manager.findOne(KgaraCase, { where: { id: caseId } });
    if (!kCase) return;

    const rows: AllocationRow[] = await manager.query(
      `SELECT f.direction, f.status, e.payment_content AS "paymentContent", e.debt_counted AS "debtCounted", a.amount
         FROM cashflow_allocations a
         JOIN cashflow_payments p ON p.id = a.payment_id
         JOIN cashflow_forecasts f ON f.id = a.forecast_id
         JOIN cashflow_garage_forecast_ext e ON e.forecast_id = f.id
        WHERE e.case_id = $1
          AND p.status = 'POSTED' AND p.is_deleted = false
          AND f.is_deleted = false`,
      [caseId],
    );

    // Chỉ tính các dòng mà bản cũ coi là settlement (cùng quy tắc shouldHaveSettlement).
    const settlements = rows.filter(
      (r) =>
        r.debtCounted &&
        shouldHaveSettlement({
          voucherType: voucherTypeOf(r.direction),
          paymentStatus: toLegacyPaymentStatus(r.direction, r.status),
          paymentContent: r.paymentContent,
        }),
    );
    const receipts = settlements
      .filter((r) => r.direction === 'IN')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const netPayable = extractNetPayableAmount(kCase);
    const paid =
      settlements.length > 0
        ? receipts
        : Number(kCase.rawData?.TienDaThanhToan || 0);

    await manager.update(
      KgaraCase,
      { id: caseId },
      {
        tienDaThanhToan: paid,
        tienConPhaiThanhToan: Math.max(0, netPayable - paid),
      },
    );
  }
}
