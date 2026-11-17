import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashflowVouchersGarageController } from './controllers/cashflow-vouchers-garage.controller';
import { CashflowVoucherGarage } from './entities/cashflow-voucher-garage.entity';
import { CashflowVoucherGarageCommandService } from './services/cashflow-voucher-garage-command.service';
import { CashflowVoucherGarageInsightService } from './services/cashflow-voucher-garage-insight.service';
import { CashflowVoucherGarageQueryService } from './services/cashflow-voucher-garage-query.service';
import { GarageVoucherCodeService } from './services/garage-voucher-code.service';

/**
 * Phiếu thu chi garage v2: đọc (list, column-options, dashboard, duplicate-check, chi tiết) và
 * lệnh ghi dòng phiếu cho orchestrator `debts-flow-garage`. Route `api/v2/cashflow-vouchers-garage`,
 * quyền `GARAGE_CASHFLOW`. Đăng ký vào `app.module.ts` ở task 2.6.1.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CashflowVoucherGarage])],
  controllers: [CashflowVouchersGarageController],
  providers: [
    GarageVoucherCodeService,
    CashflowVoucherGarageCommandService,
    CashflowVoucherGarageQueryService,
    CashflowVoucherGarageInsightService,
  ],
  exports: [
    CashflowVoucherGarageCommandService,
    CashflowVoucherGarageQueryService,
  ],
})
export class CashflowVouchersGarageModule {}
