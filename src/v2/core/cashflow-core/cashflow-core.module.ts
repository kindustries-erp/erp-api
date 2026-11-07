import { Module } from '@nestjs/common';

/** Module lõi họ cashflow-core: cung cấp service dùng chung (nếu có), không có controller. */
@Module({
  providers: [],
  exports: [],
})
export class CashflowCoreModule {}
