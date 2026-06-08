import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpBom } from './entities/erp_bom.entity';
import { ErpBomLine } from './entities/erp_bom_line.entity';
import { BomCoreController } from './bom-core.controller';
import { BomCoreService } from './bom-core.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErpBom, ErpBomLine])],
  controllers: [BomCoreController],
  providers: [BomCoreService],
  exports: [BomCoreService],
})
export class BomCoreModule {}
