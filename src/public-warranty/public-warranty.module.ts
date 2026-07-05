import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpVehicle } from '../erp-mfg-core/entities/erp_vehicle.entity';
import { ErpInventoryTrackingSerial } from '../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { ErpSerialLifecycle } from '../inventory-core/entities/erp_serial_lifecycle.entity';
import { ErpBusinessPartner } from '../business-partners-core/entities/erp_business_partner.entity';
import { PublicWarrantyController } from './public-warranty.controller';
import { PublicWarrantyService } from './public-warranty.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpVehicle,
      ErpInventoryTrackingSerial,
      ErpSerialLifecycle,
      ErpBusinessPartner,
    ]),
  ],
  controllers: [PublicWarrantyController],
  providers: [PublicWarrantyService],
})
export class PublicWarrantyModule {}
