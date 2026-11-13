import { Module } from '@nestjs/common';
import { RbacCoreModule } from '@/v2/core/rbac-core';
import { InventoryMovementsGarageVouchersController } from './controllers/inventory-movements-garage-vouchers.controller';
import { InventoryMovementsGarageVouchersService } from './inventory-movements-garage-vouchers.service';

/** Module chứng từ kho Garage: danh sách gộp nhập mua hàng, nhập khác, xuất, điều chỉnh. */
@Module({
  imports: [RbacCoreModule],
  controllers: [InventoryMovementsGarageVouchersController],
  providers: [InventoryMovementsGarageVouchersService],
})
export class InventoryMovementsGarageVouchersModule {}
