import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpOperatingExpense } from './entities/erp_operating_expense.entity';
import { ErpExpenseAccountRule } from './entities/erp_expense_account_rule.entity';
import { ErpChartOfAccount } from '../accounting-core/entities/erp_chart_of_account.entity';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { OperatingExpensesCoreController } from './operating-expenses-core.controller';
import { OperatingExpensesCoreService } from './operating-expenses-core.service';
import { SmartAccountMappingService } from './services/smart-account-mapping.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpOperatingExpense,
      ErpExpenseAccountRule,
      ErpChartOfAccount,
    ]),
    AccountingCoreModule,
  ],
  controllers: [OperatingExpensesCoreController],
  providers: [OperatingExpensesCoreService, SmartAccountMappingService],
  exports: [OperatingExpensesCoreService, SmartAccountMappingService],
})
export class OperatingExpensesCoreModule {}
