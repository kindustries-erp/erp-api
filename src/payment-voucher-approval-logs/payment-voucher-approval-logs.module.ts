import { Module } from '@nestjs/common';
import { PaymentVoucherApprovalLogsController } from './payment-voucher-approval-logs.controller';
import { PaymentVoucherApprovalLogsService } from './payment-voucher-approval-logs.service';

@Module({
  controllers: [PaymentVoucherApprovalLogsController],
  providers: [PaymentVoucherApprovalLogsService],
})
export class PaymentVoucherApprovalLogsModule {}
