import { Module } from '@nestjs/common';
import { PaymentVoucherAttachmentsController } from './payment-voucher-attachments.controller';
import { PaymentVoucherAttachmentsService } from './payment-voucher-attachments.service';

@Module({
  controllers: [PaymentVoucherAttachmentsController],
  providers: [PaymentVoucherAttachmentsService],
})
export class PaymentVoucherAttachmentsModule {}
