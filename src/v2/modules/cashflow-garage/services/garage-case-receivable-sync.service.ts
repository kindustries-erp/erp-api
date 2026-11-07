import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { parseSafeDate } from '@/kgara-api-core/utils/kgara-parser.util';
import { CashflowForecast } from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';

export interface CaseReceivableInput {
  caseId?: string;
  previousStatus?: number | null;
  newStatus?: number | null;
  ngayHoanThanhCongViec?: Date | string | null;
  tienConPhaiThanhToan?: number | null;
  khachHangName?: string | null;
  licensePlate?: string | null;
  soChungTu?: string | null;
}

const SETTLEMENT_NOTE_PREFIX = 'Tự động sinh từ phiếu';
const AUTO_CONTENT = 'Dự thu hoàn tất phiếu dịch vụ';
const AUTO_CREATED_BY = 'Hệ thống (Auto Forecast)';
const COMPLETED_STATUS = 3;

/**
 * Dự thu tự động của phiếu dịch vụ, ghi vào cashflow_* (thay GarageCaseForecastService).
 * Quy tắc giữ nguyên bản cũ:
 * - Hoàn tất (status 3): tạo hoặc cập nhật một dự thu tự động còn hiệu lực, ngày dự kiến = hoàn thành + 7 ngày.
 * - Còn phải thu bằng 0: hủy dự thu đang mở.
 * - Rời khỏi Hoàn tất: hủy dự thu tự động đang mở; dự thu đã thu/đã duyệt không bị hủy.
 * Lỗi chỉ ghi log, không làm gãy thao tác chính (như bản cũ).
 * Xóa cùng đợt với route cũ (P6).
 */
@Injectable()
export class GarageCaseReceivableSyncService {
  private readonly logger = new Logger(GarageCaseReceivableSyncService.name);

  constructor(private readonly dataSource: DataSource) {}

  /** Đặt lại dự thu của các phiếu dịch vụ đang hoàn tất (sau khi có thu/chi mới). */
  async syncCaseReceipts(
    caseIds: Array<string | null | undefined>,
  ): Promise<void> {
    const ids = [...new Set(caseIds.filter((id): id is string => !!id))];
    for (const caseId of ids) {
      try {
        const kCase = await this.dataSource
          .getRepository(KgaraCase)
          .findOne({ where: { id: caseId } });
        if (!kCase || kCase.tinhTrangDichVu !== COMPLETED_STATUS) continue;
        await this.syncCaseForecast({
          caseId,
          previousStatus: COMPLETED_STATUS,
          newStatus: COMPLETED_STATUS,
          ngayHoanThanhCongViec: kCase.ngayHoanThanhCongViec,
          tienConPhaiThanhToan: kCase.tienConPhaiThanhToan,
          khachHangName: kCase.khachHangName,
          licensePlate: kCase.bienSoXe,
          soChungTu: kCase.soChungTu,
        });
      } catch (error: unknown) {
        this.logger.warn(
          `Failed to sync receipt forecast for case ${caseId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  async syncCaseForecast(input: CaseReceivableInput): Promise<void> {
    const { caseId, previousStatus, newStatus } = input;
    if (!caseId) return;
    try {
      if (newStatus === COMPLETED_STATUS) {
        await this.upsertExpectedReceipt(input);
      } else if (
        previousStatus === COMPLETED_STATUS &&
        newStatus !== COMPLETED_STATUS
      ) {
        await this.cancelExpectedReceipt(caseId);
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to sync forecast for case ${caseId} (${previousStatus} -> ${newStatus}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async upsertExpectedReceipt(
    input: CaseReceivableInput,
  ): Promise<void> {
    const {
      caseId,
      ngayHoanThanhCongViec,
      tienConPhaiThanhToan,
      khachHangName,
      licensePlate,
      soChungTu,
    } = input;
    if (!caseId) return;
    const manager: EntityManager = this.dataSource.manager;

    const baseDate = parseSafeDate(ngayHoanThanhCongViec) || new Date();
    const transDate = formatDate(
      new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000),
    );
    const amount = Math.max(0, Number(tienConPhaiThanhToan ?? 0));

    // Dự thu tự động còn hiệu lực: IN, OPEN (legacy EXPECTED) hoặc CANCELLED.
    const existing = await findActiveAutoReceivable(manager, caseId);

    if (amount <= 0) {
      if (existing && existing.header.status === 'OPEN') {
        existing.header.status = 'CANCELLED';
        existing.header.amount = '0';
        await manager.save(existing.header);
        this.logger.log(
          `Cancelled auto-forecast ${existing.header.code} for case ${caseId}: remaining debt is 0`,
        );
      }
      return;
    }

    if (existing) {
      existing.header.amount = String(amount);
      existing.header.plannedDate = transDate;
      existing.header.status = 'OPEN';
      if (khachHangName) existing.header.partnerName = khachHangName;
      if (soChungTu && !existing.header.note) {
        existing.header.note = `${SETTLEMENT_NOTE_PREFIX} ${soChungTu}`;
      }
      await manager.save(existing.header);
      if (licensePlate) {
        existing.ext.licensePlate = licensePlate;
        await manager.save(existing.ext);
      }
      return;
    }

    const header = await manager.save(
      manager.create(CashflowForecast, {
        code: generateAutoCode(),
        direction: 'IN',
        kind: 'CASE_RECEIVABLE',
        source: 'AUTO',
        sourceType: 'CASE_COMPLETED',
        sourceId: caseId,
        partnerId: null,
        partnerName: khachHangName || null,
        branchId: null,
        amount: String(amount),
        plannedDate: transDate,
        status: 'OPEN',
        requiresApproval: false,
        note: soChungTu ? `${SETTLEMENT_NOTE_PREFIX} ${soChungTu}` : null,
        isDeleted: false,
        createdBy: null,
      }),
    );
    await manager.save(
      manager.create(CashflowGarageForecastExt, {
        forecastId: header.id,
        caseId,
        licensePlate: licensePlate || null,
        paymentContent: AUTO_CONTENT,
        isAutoExpected: true,
        isAutoCommission: false,
        legacyCreatedBy: AUTO_CREATED_BY,
        legacyPaymentMethod: null,
      }),
    );
  }

  private async cancelExpectedReceipt(caseId: string): Promise<void> {
    const manager: EntityManager = this.dataSource.manager;
    const rows = await manager
      .createQueryBuilder(CashflowForecast, 'f')
      .innerJoin(CashflowGarageForecastExt, 'ext', 'ext.forecastId = f.id')
      .where('ext.caseId = :caseId', { caseId })
      .andWhere('ext.isAutoExpected = true')
      .andWhere('f.direction = :direction', { direction: 'IN' })
      .andWhere('f.isDeleted = false')
      .andWhere('f.status = :status', { status: 'OPEN' })
      .getMany();
    if (rows.length === 0) return;
    for (const row of rows) {
      row.status = 'CANCELLED';
    }
    await manager.save(rows);
    this.logger.log(
      `Cancelled ${rows.length} auto-forecast(s) for case ${caseId}: case reverted from completed`,
    );
  }
}

async function findActiveAutoReceivable(
  manager: EntityManager,
  caseId: string,
): Promise<{
  header: CashflowForecast;
  ext: CashflowGarageForecastExt;
} | null> {
  const header = await manager
    .createQueryBuilder(CashflowForecast, 'f')
    .innerJoin(CashflowGarageForecastExt, 'ext', 'ext.forecastId = f.id')
    .where('ext.caseId = :caseId', { caseId })
    .andWhere('ext.isAutoExpected = true')
    .andWhere('f.direction = :direction', { direction: 'IN' })
    .andWhere('f.isDeleted = false')
    .andWhere('f.status IN (:...statuses)', { statuses: ['OPEN', 'CANCELLED'] })
    .orderBy('f.createdAt', 'DESC')
    .getOne();
  if (!header) return null;
  const ext = await manager.findOneBy(CashflowGarageForecastExt, {
    forecastId: header.id,
  });
  return ext ? { header, ext } : null;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateAutoCode(): string {
  const dateStr = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')
    .substring(2);
  const suffix =
    Date.now().toString().slice(-4) +
    Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
  return `DT-GARA-${dateStr}-${suffix}`;
}
