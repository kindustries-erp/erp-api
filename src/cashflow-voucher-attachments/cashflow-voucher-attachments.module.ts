import { Module } from '@nestjs/common';
import { CashflowVoucherAttachmentsController } from './cashflow-voucher-attachments.controller';
import { CashflowVoucherAttachmentsService } from './cashflow-voucher-attachments.service';

@Module({
  controllers: [CashflowVoucherAttachmentsController],
  providers: [CashflowVoucherAttachmentsService],
})
export class CashflowVoucherAttachmentsModule {}
