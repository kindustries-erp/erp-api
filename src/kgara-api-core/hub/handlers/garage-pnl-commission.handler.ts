import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraOperatingExpense } from '../../entities/kgara_operating_expense.entity';
import { KgaraCashflowVoucher } from '../../entities/kgara_cashflow_voucher.entity';
import {
  PnlCommissionEvent,
  PnlCommissionSyncResult,
} from '../garage-hub.types';
import {
  PAYMENT_CONTENT_SALE_COMMISSION,
  PAYMENT_CONTENT_DV_COMMISSION,
} from '../../helpers/garage-cashflow-payment-rules';

@Injectable()
export class GaragePnlCommissionHandler {
  private readonly logger = new Logger(GaragePnlCommissionHandler.name);

  constructor(
    @InjectRepository(KgaraOperatingExpense)
    private readonly opexRepo: Repository<KgaraOperatingExpense>,
    @InjectRepository(KgaraCashflowVoucher)
    private readonly voucherRepo: Repository<KgaraCashflowVoucher>,
  ) {}

  /**
   * Use Case 3: Điều phối chốt hoa hồng P&L sang chi phí OPEX và phiếu chi Cashflow
   * - Tách biệt logic tạo chứng từ khỏi logic tính toán P&L
   * - Cơ chế Delta Lock: Phiếu hoa hồng đã PAID không bao giờ bị sửa amount
   */
  async handlePnlCommissionSync(
    event: PnlCommissionEvent,
  ): Promise<PnlCommissionSyncResult> {
    const { year, month, saleCommission, dvCommission, kyGuiProfitRate } =
      event;

    let syncedVouchers = 0;
    let createdVouchers = 0;
    let updatedVouchers = 0;
    let deltaVouchers = 0;
    let syncedOpex = 0;

    const commissionConfigs = [
      {
        type: 'HOA_HONG_SALE' as const,
        amount: saleCommission,
        paymentContent: PAYMENT_CONTENT_SALE_COMMISSION,
        categoryKey: 'HOA_HONG_SALE',
        categoryName: 'Hoa hồng cho Sale (10%)',
        calcNote: `10% LN ký gửi (${kyGuiProfitRate.toFixed(1)}% tỷ lệ ký gửi)`,
      },
      {
        type: 'HOA_HONG_DV' as const,
        amount: dvCommission,
        paymentContent: PAYMENT_CONTENT_DV_COMMISSION,
        categoryKey: 'HOA_HONG_DV',
        categoryName: 'Hoa hồng cho DV (10%)',
        calcNote: '10% LN ròng sau trừ HH Sale',
      },
    ];

    for (const item of commissionConfigs) {
      // 1. Đồng bộ vào bảng kgara_operating_expenses
      let opex = await this.opexRepo.findOne({
        where: {
          periodYear: year,
          periodMonth: month,
          categoryKey: item.categoryKey,
        },
      });

      const opexNote = `Tự động tính từ P&L (${item.calcNote})`;
      if (!opex) {
        opex = this.opexRepo.create({
          periodYear: year,
          periodMonth: month,
          categoryKey: item.categoryKey,
          categoryName: item.categoryName,
          amount: item.amount,
          ojAmount: 0,
          note: opexNote,
        });
      } else {
        opex.amount = item.amount;
        opex.note = opexNote;
      }
      await this.opexRepo.save(opex);
      syncedOpex++;

      // 2. Đồng bộ vào bảng kgara_cashflow_vouchers
      const existingVouchers = await this.voucherRepo.find({
        where: {
          pnlPeriodYear: year,
          pnlPeriodMonth: month,
          pnlCommissionType: item.type,
          isAutoCommission: true,
        },
        order: { createdAt: 'ASC' },
      });

      const paidVouchers = existingVouchers.filter(
        (v) => v.paymentStatus === 'PAID',
      );
      const activePending = existingVouchers.find(
        (v) => v.paymentStatus === 'PENDING' || v.paymentStatus === 'APPROVED',
      );

      const periodStr = `${String(month).padStart(2, '0')}/${year}`;
      let nextMonthYear = year;
      let nextMonth = month + 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextMonthYear += 1;
      }
      const defaultTransDate = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-10`;

      if (paidVouchers.length > 0) {
        // ĐÃ CÓ PHIẾU ĐÃ CHI (PAID): Khóa cứng số tiền đã chi, chỉ tính chênh lệch delta
        const totalPaid = paidVouchers.reduce(
          (sum, v) => sum + (Number(v.amount) || 0),
          0,
        );
        const delta = item.amount - totalPaid;

        if (delta > 0) {
          if (activePending) {
            activePending.amount = delta;
            activePending.note = `Chi hoa hồng ${item.categoryName} T${periodStr} (phần chênh lệch bổ sung sau khi đã chi ${totalPaid.toLocaleString('vi-VN')} đ)`;
            activePending.transDate = defaultTransDate;
            await this.voucherRepo.save(activePending);
            updatedVouchers++;
          } else {
            const anchorVoucher = paidVouchers[0];
            const dateStr = defaultTransDate.replace(/-/g, '').substring(2);
            const randomSeq = Math.floor(Math.random() * 1000)
              .toString()
              .padStart(3, '0');
            const generatedCode = `PC-GARA-${dateStr}-${randomSeq}`;

            const newDeltaVoucher = this.voucherRepo.create({
              voucherCode: generatedCode,
              voucherType: 'PAYMENT',
              paymentStatus: 'PENDING',
              amount: delta,
              transDate: defaultTransDate,
              paymentContent: item.paymentContent,
              partnerName: item.categoryName,
              note: `Chi hoa hồng ${item.categoryName} T${periodStr} (phần chênh lệch bổ sung sau khi đã chi ${totalPaid.toLocaleString('vi-VN')} đ)`,
              createdBy: 'Hệ thống (P&L Auto)',
              isAutoCommission: true,
              pnlPeriodYear: year,
              pnlPeriodMonth: month,
              pnlCommissionType: item.type,
              pnlCommissionAnchorId: anchorVoucher.id,
            });
            await this.voucherRepo.save(newDeltaVoucher);
            createdVouchers++;
            deltaVouchers++;
          }
          syncedVouchers++;
        } else if (activePending) {
          activePending.paymentStatus = 'CANCELLED';
          await this.voucherRepo.save(activePending);
        }
      } else {
        // CHƯA CÓ PHIẾU NÀO ĐÃ CHI (PAID)
        if (item.amount > 0) {
          if (activePending) {
            activePending.amount = item.amount;
            activePending.note = `Chi hoa hồng ${item.categoryName} T${periodStr} (tính từ P&L)`;
            activePending.transDate = defaultTransDate;
            await this.voucherRepo.save(activePending);
            updatedVouchers++;
          } else {
            const dateStr = defaultTransDate.replace(/-/g, '').substring(2);
            const randomSeq = Math.floor(Math.random() * 1000)
              .toString()
              .padStart(3, '0');
            const generatedCode = `PC-GARA-${dateStr}-${randomSeq}`;

            const newVoucher = this.voucherRepo.create({
              voucherCode: generatedCode,
              voucherType: 'PAYMENT',
              paymentStatus: 'PENDING',
              amount: item.amount,
              transDate: defaultTransDate,
              paymentContent: item.paymentContent,
              partnerName: item.categoryName,
              note: `Chi hoa hồng ${item.categoryName} T${periodStr} (tính từ P&L)`,
              createdBy: 'Hệ thống (P&L Auto)',
              isAutoCommission: true,
              pnlPeriodYear: year,
              pnlPeriodMonth: month,
              pnlCommissionType: item.type,
            });
            await this.voucherRepo.save(newVoucher);
            createdVouchers++;
          }
          syncedVouchers++;
        } else if (activePending) {
          activePending.paymentStatus = 'CANCELLED';
          await this.voucherRepo.save(activePending);
        }
      }
    }

    return {
      year,
      month,
      saleCommission,
      dvCommission,
      syncedOpex,
      syncedVouchers,
      createdVouchers,
      updatedVouchers,
      deltaVouchers,
    };
  }
}
