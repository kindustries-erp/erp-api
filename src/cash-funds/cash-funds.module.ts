import { Module } from '@nestjs/common';
import { CashFundsController } from './cash-funds.controller';
import { CashFundsService } from './cash-funds.service';

@Module({
  controllers: [CashFundsController],
  providers: [CashFundsService],
})
export class CashFundsModule {}
