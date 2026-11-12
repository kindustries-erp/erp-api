import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GarageItem } from './entities/garage-item.entity';
import { GarageItemController } from './controllers/garage-item.controller';
import { ItemsGarageService } from './items-garage.service';
import { GARAGE_ITEM_CATALOG } from './items-garage.tokens';
import { GarageItemCommandService } from './services/garage-item-command.service';
import { GarageItemMatchService } from './services/garage-item-match.service';
import { GarageItemQueryService } from './services/garage-item-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([GarageItem])],
  controllers: [GarageItemController],
  providers: [
    ItemsGarageService,
    GarageItemQueryService,
    GarageItemCommandService,
    GarageItemMatchService,
    { provide: GARAGE_ITEM_CATALOG, useExisting: GarageItemMatchService },
  ],
  exports: [ItemsGarageService, GARAGE_ITEM_CATALOG],
})
export class ItemsGarageModule {}
