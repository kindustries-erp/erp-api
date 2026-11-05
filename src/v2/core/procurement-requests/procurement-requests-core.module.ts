import { Module } from '@nestjs/common';

/** Module lõi họ procurement-requests: cung cấp service dùng chung (nếu có), không có controller. */
@Module({
  providers: [],
  exports: [],
})
export class ProcurementRequestsCoreModule {}
