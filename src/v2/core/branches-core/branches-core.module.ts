import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpBranch } from './entities/erp_branch.entity';
import { BranchQueryService } from './services/branch-query.service';
import { BranchCommandService } from './services/branch-command.service';
import { BranchesCoreService } from './services/branches-core.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErpBranch])],
  providers: [BranchQueryService, BranchCommandService, BranchesCoreService],
  exports: [BranchesCoreService],
})
export class BranchesCoreModule {}
