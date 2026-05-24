import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CashflowVouchersController } from './cashflow-vouchers.controller';
import { CashflowVouchersService } from './cashflow-vouchers.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [CashflowVouchersController],
  providers: [CashflowVouchersService],
  exports: [CashflowVouchersService],
})
export class CashflowVouchersModule {}
