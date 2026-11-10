import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '@/v2/core/branches-core';
import { ErpBranchController } from './controllers/erp-branch.controller';
import { BranchesManagementService } from './branches-management.service';

@Module({
  imports: [BranchesCoreModule],
  controllers: [ErpBranchController],
  providers: [BranchesManagementService],
  exports: [BranchesManagementService],
})
export class BranchesManagementModule {}
