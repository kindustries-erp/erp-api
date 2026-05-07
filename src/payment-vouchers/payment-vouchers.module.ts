import { Module } from '@nestjs/common';
import { PaymentVouchersController } from './payment-vouchers.controller';
import { PaymentVouchersService } from './payment-vouchers.service';

@Module({
  controllers: [PaymentVouchersController],
  providers: [PaymentVouchersService],
})
export class PaymentVouchersModule {}
