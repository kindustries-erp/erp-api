import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CoreUser } from '../../../users/entities/core-user.entity';
import { ErpAction } from '../rbac-core/enums';
import { RbacCoreService } from '../rbac-core/services/rbac-core.service';

export interface ApproverOption {
  id: string;
  email: string;
}

/**
 * Danh sách người duyệt hợp lệ cho một resource: user đang ACTIVE và có đủ
 * quyền APPROVE + REJECT trên resource đó. Người gọi không nằm trong danh sách.
 */
@Injectable()
export class ApproverDirectoryService {
  constructor(
    private readonly rbac: RbacCoreService,
    @InjectRepository(CoreUser)
    private readonly users: Repository<CoreUser>,
  ) {}

  async listApprovers(
    resource: string,
    excludeUserId?: string | null,
  ): Promise<ApproverOption[]> {
    const ids = await this.rbac.findUserIdsWithPermissions(resource, [
      String(ErpAction.APPROVE),
      String(ErpAction.REJECT),
    ]);
    const candidates = ids.filter((id) => id !== excludeUserId);
    if (candidates.length === 0) return [];

    const users = await this.users.find({
      where: { id: In(candidates), status: 'ACTIVE' },
      select: ['id', 'email'],
      order: { email: 'ASC' },
    });
    return users.map((u) => ({ id: u.id, email: u.email }));
  }

  /** Ném 400 nếu người được chọn không nằm trong danh sách người duyệt hợp lệ. */
  async assertEligible(
    resource: string,
    approverId: string,
    actorId: string,
  ): Promise<void> {
    const approvers = await this.listApprovers(resource, actorId);
    if (!approvers.some((a) => a.id === approverId)) {
      throw new BadRequestException(
        'Người duyệt không hợp lệ hoặc không có quyền duyệt',
      );
    }
  }
}
