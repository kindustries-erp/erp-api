import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, DataSource } from 'typeorm';
import {
  CashflowSettledEvent,
  CashflowSettledResult,
} from '../garage-hub.types';
import {
  isRecordedToOpex,
  isCommissionPaymentContent,
} from '../../helpers/garage-cashflow-payment-rules';
import {
  syncOpexFromVoucher,
  removeOpexForVoucher,
} from '../../helpers/garage-cashflow-opex-sync.helper';

@Injectable()
export class GarageCashflowSettleHandler {
  private readonly logger = new Logger(GarageCashflowSettleHandler.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Use Case 2: Điều phối khi phiếu thu chi xưởng được thanh toán / thay đổi
   * 1. Nếu phiếu chi thuộc nhóm 4. HHBH hoặc 10. Vật tư tiêu hao (APPROVED/PAID) -> Tự động sync sang kgara_operating_expenses
   * 2. Nếu không đủ điều kiện (hoặc bị hủy) -> Gỡ dòng OPEX tương ứng
   * 3. Bảo vệ: Nhận diện nội dung hoa hồng P&L để chặn không cho trừ công nợ case
   */
  async handleCashflowSettled(
    event: CashflowSettledEvent,
    customManager?: EntityManager,
  ): Promise<CashflowSettledResult> {
    const { voucher } = event;
    const isProtected = isCommissionPaymentContent(voucher.paymentContent);

    const executeWithManager = async (manager: EntityManager) => {
      const shouldSyncOpex = isRecordedToOpex(voucher);

      if (shouldSyncOpex) {
        await syncOpexFromVoucher(manager, voucher);
        this.logger.log(
          `[Hub] Synced voucher ${voucher.voucherCode} (${voucher.paymentContent}) to garage-opex`,
        );
        return {
          voucherId: voucher.id,
          syncedToOpex: true,
          isCommissionProtected: isProtected,
        };
      } else if (voucher.id) {
        await removeOpexForVoucher(manager, voucher.id);
      }

      return {
        voucherId: voucher.id,
        syncedToOpex: false,
        isCommissionProtected: isProtected,
      };
    };

    if (customManager) {
      return executeWithManager(customManager);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const result = await executeWithManager(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[Hub] Error handling cashflow settlement for voucher ${voucher?.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
