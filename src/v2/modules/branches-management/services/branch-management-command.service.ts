import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractBranchCommandService } from '@/v2/core/branches-core';
import { BranchManagement } from '../entities/branch-management.entity';
import { BranchReferenceService } from './branch-reference.service';

@Injectable()
export class BranchManagementCommandService extends AbstractBranchCommandService<BranchManagement> {
  constructor(
    @InjectRepository(BranchManagement)
    protected readonly repository: Repository<BranchManagement>,
    protected readonly references: BranchReferenceService,
  ) {
    super();
  }
}
