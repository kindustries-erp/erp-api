import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacCoreModule } from '@/v2/core/rbac-core';
import { InventoryMovementsGarageLedgerController } from './controllers/inventory-movements-garage-ledger.controller';
import { InventoryMovementsGarageBalance } from './entities/inventory-movements-garage-balance.entity';
import { InventoryMovementsGarageCostLayer } from './entities/inventory-movements-garage-cost-layer.entity';
import { InventoryMovementsGarageTransaction } from './entities/inventory-movements-garage-transaction.entity';
import { InventoryMovementsGarageLedgerService } from './inventory-movements-garage-ledger.service';

/**
 * Đăng ký 3 entity sổ tồn garage để TypeORM (autoLoadEntities) nạp metadata, và mở API đọc
 * tồn kho (số dư, thẻ kho). Core đọc/ghi các bảng này qua manager.getRepository.
 */
@Module({
  imports: [
    RbacCoreModule,
    TypeOrmModule.forFeature([
      InventoryMovementsGarageBalance,
      InventoryMovementsGarageTransaction,
      InventoryMovementsGarageCostLayer,
    ]),
  ],
  controllers: [InventoryMovementsGarageLedgerController],
  providers: [InventoryMovementsGarageLedgerService],
  exports: [TypeOrmModule],
})
export class InventoryMovementsGarageLedgerModule {}
