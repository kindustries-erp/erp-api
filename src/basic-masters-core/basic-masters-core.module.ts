import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErpBusinessPartner } from '../business-partners-core/entities/erp_business_partner.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpUom } from '../inventory-core/entities/erp_uom.entity';
import { ErpItemType } from '../inventory-core/entities/erp_item_type.entity';
import { ErpEmployee } from '../employees-core/entities/erp_employee.entity';
import { BasicMastersCoreController } from './basic-masters-core.controller';
import { BasicMastersCoreService } from './basic-masters-core.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpBusinessPartner,
      ErpInventoryItem,
      ErpUom,
      ErpItemType,
      ErpEmployee,
    ]),
  ],
  controllers: [BasicMastersCoreController],
  providers: [BasicMastersCoreService, JwtAuthGuard],
  exports: [BasicMastersCoreService],
})
export class BasicMastersCoreModule {}
