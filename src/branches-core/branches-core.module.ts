import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchesCoreController } from './branches-core.controller';
import { BranchesCoreService } from './branches-core.service';
import { ErpBranch } from './entities/erp_branch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ErpBranch])],
  controllers: [BranchesCoreController],
  providers: [BranchesCoreService],
  exports: [BranchesCoreService],
})
export class BranchesCoreModule {}
