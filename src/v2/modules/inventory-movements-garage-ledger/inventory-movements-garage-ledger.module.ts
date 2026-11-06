import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryMovementsGarageBalance } from './entities/inventory-movements-garage-balance.entity';
import { InventoryMovementsGarageCostLayer } from './entities/inventory-movements-garage-cost-layer.entity';
import { InventoryMovementsGarageTransaction } from './entities/inventory-movements-garage-transaction.entity';

/**
 * Đăng ký 3 entity sổ tồn garage để TypeORM (autoLoadEntities) nạp metadata.
 * Core đọc/ghi các bảng này qua manager.getRepository, nên phải có forFeature ở đâu đó trong app.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryMovementsGarageBalance,
      InventoryMovementsGarageTransaction,
      InventoryMovementsGarageCostLayer,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class InventoryMovementsGarageLedgerModule {}
