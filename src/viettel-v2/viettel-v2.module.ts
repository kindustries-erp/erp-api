import { Module } from '@nestjs/common';
import { ViettelV2Controller } from './viettel-v2.controller';
import { ViettelV2Service } from './viettel-v2.service';

@Module({
  controllers: [ViettelV2Controller],
  providers: [ViettelV2Service],
  exports: [ViettelV2Service],
})
export class ViettelV2Module {}
