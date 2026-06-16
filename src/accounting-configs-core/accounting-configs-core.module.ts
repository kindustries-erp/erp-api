import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingConfigsCoreService } from './accounting-configs-core.service';
import { AccountingConfigsCoreController } from './accounting-configs-core.controller';
import { ErpModuleAccountingConfig } from './entities/erp_module_accounting_config.entity';
import { ErpChartOfAccount } from '../journal-entries/entities/erp_chart_of_account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ErpModuleAccountingConfig, ErpChartOfAccount]),
  ],
  controllers: [AccountingConfigsCoreController],
  providers: [AccountingConfigsCoreService],
  exports: [AccountingConfigsCoreService],
})
export class AccountingConfigsCoreModule {}
