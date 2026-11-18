import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpBranchController } from './controllers/erp-branch.controller';
import { BranchManagement } from './entities/branch-management.entity';
import { BranchManagementExternalLink } from './entities/branch-management-external-link.entity';
import { BranchesManagementService } from './branches-management.service';
import { BranchExternalLinkService } from './services/branch-external-link.service';
import { BranchManagementCommandService } from './services/branch-management-command.service';
import { BranchManagementQueryService } from './services/branch-management-query.service';
import { BranchReferenceService } from './services/branch-reference.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BranchManagement, BranchManagementExternalLink]),
  ],
  controllers: [ErpBranchController],
  providers: [
    BranchReferenceService,
    BranchManagementQueryService,
    BranchManagementCommandService,
    BranchExternalLinkService,
    BranchesManagementService,
  ],
  exports: [BranchesManagementService, BranchExternalLinkService],
})
export class BranchesManagementModule {}
