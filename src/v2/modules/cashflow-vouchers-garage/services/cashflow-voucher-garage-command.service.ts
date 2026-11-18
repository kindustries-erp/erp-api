import { Injectable } from '@nestjs/common';
import { AbstractCashflowVoucherCommandService } from '@/v2/core/cashflow-vouchers-core';
import { CashflowVoucherGarage } from '../entities/cashflow-voucher-garage.entity';
import { GarageVoucherCodeService } from './garage-voucher-code.service';

/**
 * Lệnh ghi dòng phiếu thu chi garage. Chỉ chạy trong transaction của orchestrator `debts-flow-garage`
 * (cùng phân bổ công nợ); không có route ghi trực tiếp ở module này.
 */
@Injectable()
export class CashflowVoucherGarageCommandService extends AbstractCashflowVoucherCommandService {
  protected readonly voucherTarget = CashflowVoucherGarage;

  constructor(protected readonly codes: GarageVoucherCodeService) {
    super();
  }
}
