import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpModuleCategory } from './entities/erp_module_category.entity';
import { ErpModuleAttributeDef } from './entities/erp_module_attribute_def.entity';
import { ErpEntityAttributeValue } from './entities/erp_entity_attribute_value.entity';
import { ModuleConfigController } from './module-config.controller';
import { ModuleConfigService } from './module-config.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpModuleCategory,
      ErpModuleAttributeDef,
      ErpEntityAttributeValue,
    ]),
  ],
  controllers: [ModuleConfigController],
  providers: [ModuleConfigService],
  exports: [ModuleConfigService],
})
export class ModuleConfigModule {}
