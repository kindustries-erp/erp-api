import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpOperatingExpense } from './entities/erp_operating_expense.entity';
import { OperatingExpensesCoreController } from './operating-expenses-core.controller';
import { OperatingExpensesCoreService } from './operating-expenses-core.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErpOperatingExpense])],
  controllers: [OperatingExpensesCoreController],
  providers: [OperatingExpensesCoreService],
  exports: [OperatingExpensesCoreService],
})
export class OperatingExpensesCoreModule {}
