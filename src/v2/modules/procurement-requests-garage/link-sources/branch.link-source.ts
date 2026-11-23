import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  LinkSourcePort,
  LinkSourceValues,
} from '@/v2/core/link-override-core';
import { BranchManagement } from '@/v2/modules/branches-management/entities/branch-management.entity';

/**
 * Nguồn liên kết của đề nghị mua: bản ghi chi nhánh. CHỈ ĐỌC, không bao giờ ghi vào chi nhánh.
 * Ánh xạ cột nguồn → field cục bộ: `branches_management.name` → `branchName`.
 */
@Injectable()
export class ProcurementRequestBranchLinkSource implements LinkSourcePort {
  constructor(
    @InjectRepository(BranchManagement)
    private readonly branches: Repository<BranchManagement>,
  ) {}

  async findValues(branchId: string): Promise<LinkSourceValues | null> {
    const branch = await this.branches.findOne({
      where: { id: branchId, isDeleted: false },
      select: ['id', 'name'],
    });
    return branch ? { branchName: branch.name } : null;
  }
}
