import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import { parseSafeDate } from '../utils/kgara-parser.util';

export interface CaseForecastInput {
  caseId?: string;
  previousStatus?: number | null;
  newStatus?: number | null;
  ngayHoanThanhCongViec?: Date | string | null;
  tienConPhaiThanhToan?: number | null;
  tienCoThue?: number | null;
  khachHangName?: string | null;
  licensePlate?: string | null;
  soChungTu?: string | null;
}

@Injectable()
export class GarageCaseForecastService {
  private readonly logger = new Logger(GarageCaseForecastService.name);

  constructor(
    @InjectRepository(KgaraCashflowVoucher)
    private readonly voucherRepo: Repository<KgaraCashflowVoucher>,
  ) {}

  /**
   * Router đồng bộ dự thu theo thay đổi trạng thái của case:
   * - Rule 1: status -> 3 (Hoàn tất) => Upsert phiếu RECEIPT/EXPECTED (+7 ngày).
   * - Rule 2: previousStatus === 3 && newStatus !== 3 => Cancel phiếu RECEIPT/EXPECTED auto.
   */
  async syncCaseForecast(input: CaseForecastInput): Promise<void> {
    const { caseId, previousStatus, newStatus } = input;
    if (!caseId) return;

    try {
      // Rule 1: Chuyển sang Hoàn tất (status 3)
      if (newStatus === 3) {
        await this.upsertExpectedReceipt(input);
      }
      // Rule 2: Rời khỏi Hoàn tất (từ status 3 sang status khác)
      else if (previousStatus === 3 && newStatus !== 3) {
        await this.cancelExpectedReceipt(caseId);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to sync forecast for case ${caseId} (${previousStatus} -> ${newStatus}): ${error.message}`,
        error.stack,
      );
      // Non-blocking: không throw để không làm gãy luồng sync chính
    }
  }

  private async upsertExpectedReceipt(
    input: CaseForecastInput,
  ): Promise<KgaraCashflowVoucher | null> {
    const {
      caseId,
      ngayHoanThanhCongViec,
      tienConPhaiThanhToan,
      khachHangName,
      licensePlate,
      soChungTu,
    } = input;
    if (!caseId) return null;

    // Ngày giao dịch dự kiến: Hoàn thành + 7 ngày (hoặc hôm nay + 7 ngày nếu không có ngày HT)
    const baseDate = parseSafeDate(ngayHoanThanhCongViec) || new Date();
    const targetDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const transDate = this.formatDateString(targetDate);
    const amount = Math.max(0, Number(tienConPhaiThanhToan ?? 0));

    // Tìm phiếu RECEIPT auto hiện có liên kết với case
    const existing = await this.voucherRepo.findOne({
      where: {
        caseId,
        voucherType: 'RECEIPT',
        isAutoExpected: true,
      },
    });

    if (existing) {
      // Bảo vệ: Nếu phiếu đã được thu thực tế (PAID) hoặc đã duyệt (APPROVED) thì không đè/hủy
      if (
        existing.paymentStatus === 'PAID' ||
        existing.paymentStatus === 'APPROVED'
      ) {
        this.logger.log(
          `Case ${caseId} already has settled/approved receipt ${existing.voucherCode}. Skip auto-forecast update.`,
        );
        return existing;
      }

      // Cập nhật lại số tiền, ngày dự thu, và mở lại EXPECTED nếu trước đó bị CANCELLED
      existing.amount = amount;
      existing.transDate = transDate;
      existing.paymentStatus = 'EXPECTED';
      if (khachHangName) existing.partnerName = khachHangName;
      if (licensePlate) existing.licensePlate = licensePlate;
      if (soChungTu && !existing.note) {
        existing.note = `Tự động sinh từ phiếu ${soChungTu}`;
      }

      const saved = await this.voucherRepo.save(existing);
      this.logger.log(
        `Updated auto-forecast receipt ${saved.voucherCode} for case ${caseId} (amount: ${amount}, transDate: ${transDate})`,
      );
      return saved;
    }

    // Nếu chưa có phiếu auto -> Tạo mới
    const voucherCode = this.generateVoucherCode();
    const voucher = this.voucherRepo.create({
      voucherCode,
      voucherType: 'RECEIPT',
      paymentStatus: 'EXPECTED',
      isAutoExpected: true,
      amount,
      transDate,
      caseId,
      licensePlate: licensePlate || undefined,
      partnerName: khachHangName || undefined,
      paymentContent: 'Dự thu hoàn tất phiếu dịch vụ',
      note: soChungTu ? `Tự động sinh từ phiếu ${soChungTu}` : undefined,
      createdBy: 'Hệ thống (Auto Forecast)',
    });

    const saved = await this.voucherRepo.save(voucher);
    this.logger.log(
      `Created auto-forecast receipt ${saved.voucherCode} for case ${caseId} (amount: ${amount}, transDate: ${transDate})`,
    );
    return saved;
  }

  private async cancelExpectedReceipt(caseId: string): Promise<void> {
    const vouchers = await this.voucherRepo.find({
      where: {
        caseId,
        voucherType: 'RECEIPT',
        isAutoExpected: true,
      },
    });

    if (!vouchers.length) return;

    for (const v of vouchers) {
      // Chỉ hủy các phiếu đang ở trạng thái EXPECTED
      // Phiếu PAID / APPROVED tuyệt đối không được tự động hủy
      if (v.paymentStatus === 'EXPECTED') {
        v.paymentStatus = 'CANCELLED';
        await this.voucherRepo.save(v);
        this.logger.log(
          `Cancelled auto-forecast receipt ${v.voucherCode} for case ${caseId} because case reverted from status 3`,
        );
      }
    }
  }

  private formatDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private generateVoucherCode(): string {
    const now = new Date();
    const dateStr = now
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
}
