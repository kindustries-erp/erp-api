import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BranchManagementExternalLink } from '../entities/branch-management-external-link.entity';

export interface BranchExternalLinkInput {
  branchId: string;
  source: string;
  externalId: string;
  accountKey?: string;
}

/** Tra cứu và tạo liên kết chi nhánh hệ thống với nguồn ngoài (chưa gắn vào luồng garage). */
@Injectable()
export class BranchExternalLinkService {
  constructor(
    @InjectRepository(BranchManagementExternalLink)
    private readonly repository: Repository<BranchManagementExternalLink>,
  ) {}

  /** `accountKey` bỏ trống: lấy mọi liên kết cùng `external_id` (ví dụ GR và CN2 dùng chung). */
  findByExternal(source: string, externalId: string, accountKey?: string) {
    return this.repository.find({
      where: {
        source,
        externalId,
        isDeleted: false,
        ...(accountKey !== undefined ? { accountKey } : {}),
      },
      order: { accountKey: 'ASC' },
    });
  }

  findByBranch(branchId: string) {
    return this.repository.find({
      where: { branchId, isDeleted: false },
      order: { source: 'ASC', accountKey: 'ASC' },
    });
  }

  /** Idempotent theo khóa (source, externalId, accountKey); trả về `created` để script báo cáo. */
  async link(input: BranchExternalLinkInput) {
    const accountKey = input.accountKey ?? '';
    const existing = await this.repository.findOne({
      where: {
        source: input.source,
        externalId: input.externalId,
        accountKey,
        isDeleted: false,
      },
    });
    if (existing) return { link: existing, created: false };
    const link = await this.repository.save(
      this.repository.create({ ...input, accountKey }),
    );
    return { link, created: true };
  }
}
