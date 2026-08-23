import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpBomCategory } from '../bom-config/entities/erp_bom_category.entity';
import { ErpBomAttributeDef } from '../bom-config/entities/erp_bom_attribute_def.entity';
import { ErpBomAttributeValue } from '../bom-config/entities/erp_bom_attribute_value.entity';
import { ErpEntityAttributeValue } from './entities/erp_entity_attribute_value.entity';
import { ModuleConfigController } from './module-config.controller';
import { ModuleConfigService } from './module-config.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpBomCategory,
      ErpBomAttributeDef,
      ErpBomAttributeValue,
      ErpEntityAttributeValue,
    ]),
  ],
  controllers: [ModuleConfigController],
  providers: [ModuleConfigService],
  exports: [ModuleConfigService],
})
export class ModuleConfigModule {}
