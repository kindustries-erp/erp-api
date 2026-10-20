import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../../entities/kgara_case.entity';
import { GarageCaseForecastService } from '../../services/garage-case-forecast.service';
import { CaseTransitionEvent, CaseTransitionResult } from '../garage-hub.types';

@Injectable()
export class GarageCaseLifecycleHandler {
  private readonly logger = new Logger(GarageCaseLifecycleHandler.name);

  constructor(
    private readonly forecastService: GarageCaseForecastService,
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
  ) {}

  /**
   * Use Case 2: Phiếu thu/chi của case đã thay đổi (tạo, sửa, xóa). Khi case đang Hoàn tất,
   * đặt lại Dự thu theo còn phải thu hiện tại để khách thu một phần thì dự thu giảm theo.
   */
  async handleReceiptChanged(caseId: string): Promise<CaseTransitionResult> {
    if (!caseId) {
      return { caseId: '', handled: false, actionTaken: 'NO_OP' };
    }
    const kCase = await this.caseRepo.findOne({ where: { id: caseId } });
    if (!kCase || kCase.tinhTrangDichVu !== 3) {
      return { caseId, handled: false, actionTaken: 'NO_OP' };
    }
    await this.forecastService.syncCaseForecast({
      caseId,
      previousStatus: 3,
      newStatus: 3,
      ngayHoanThanhCongViec: kCase.ngayHoanThanhCongViec,
      tienConPhaiThanhToan: kCase.tienConPhaiThanhToan,
      tienCoThue: kCase.tienCoThue,
      khachHangName: kCase.khachHangName,
      licensePlate: kCase.bienSoXe,
      soChungTu: kCase.soChungTu,
    });
    return { caseId, handled: true, actionTaken: 'UPDATED_EXPECTED' };
  }

  /**
   * Use Case 1: Điều phối vòng đời case khi chuyển trạng thái
   * - Hoàn tất (status 3): Tự sinh/mở lại Dự thu (+7 ngày)
   * - Revert khỏi Hoàn tất (3 -> khác 3): Đổi phiếu Dự thu sang CANCELLED
   */
  async handleCaseTransition(
    event: CaseTransitionEvent,
  ): Promise<CaseTransitionResult> {
    const { caseId, previousStatus, newStatus } = event;

    if (!caseId) {
      return { caseId: '', handled: false, actionTaken: 'NO_OP' };
    }

    try {
      if (newStatus === 3) {
        await this.forecastService.syncCaseForecast(event);
        this.logger.log(
          `[Hub] Case ${caseId} completed (status 3). Synced auto expected receipt.`,
        );
        return {
          caseId,
          handled: true,
          actionTaken:
            previousStatus === 3 ? 'UPDATED_EXPECTED' : 'CREATED_EXPECTED',
        };
      }

      if (previousStatus === 3 && newStatus !== 3) {
        await this.forecastService.syncCaseForecast(event);
        this.logger.log(
          `[Hub] Case ${caseId} reverted from completed (${previousStatus} -> ${newStatus}). Marked expected receipt as CANCELLED.`,
        );
        return {
          caseId,
          handled: true,
          actionTaken: 'CANCELLED_EXPECTED',
        };
      }

      return {
        caseId,
        handled: false,
        actionTaken: 'NO_OP',
      };
    } catch (error: any) {
      this.logger.error(
        `[Hub] Error handling case transition for ${caseId}: ${error.message}`,
        error.stack,
      );
      return {
        caseId,
        handled: false,
        actionTaken: 'NO_OP',
      };
    }
  }
}
