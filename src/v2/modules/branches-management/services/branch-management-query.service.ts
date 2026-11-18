import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractBranchQueryService } from '@/v2/core/branches-core';
import { BranchManagement } from '../entities/branch-management.entity';

@Injectable()
export class BranchManagementQueryService extends AbstractBranchQueryService<BranchManagement> {
  constructor(
    @InjectRepository(BranchManagement)
    protected readonly repository: Repository<BranchManagement>,
  ) {
    super();
  }
}
