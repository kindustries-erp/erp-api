import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpBomCategory } from './entities/erp_bom_category.entity';
import { ErpBomAttributeDef } from './entities/erp_bom_attribute_def.entity';
import { ErpBomAttributeValue } from './entities/erp_bom_attribute_value.entity';
import { BomConfigController } from './bom-config.controller';
import { BomConfigService } from './bom-config.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpBomCategory,
      ErpBomAttributeDef,
      ErpBomAttributeValue,
    ]),
  ],
  controllers: [BomConfigController],
  providers: [BomConfigService],
  exports: [BomConfigService],
})
export class BomConfigModule {}
