import { Module } from '@nestjs/common';
import { DirectusModule } from '../directus/directus.module';
import { ErpManufacturingController } from './erp-manufacturing.controller';
import { ErpManufacturingService } from './erp-manufacturing.service';

@Module({
  imports: [DirectusModule],
  controllers: [ErpManufacturingController],
  providers: [ErpManufacturingService],
  exports: [ErpManufacturingService],
})
export class ErpManufacturingModule {}
