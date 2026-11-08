import { ErpBranch } from '@/v2/core/branches-core/entities/erp_branch.entity';
import { ErpBranchResponseDto } from '../dto/erp-branch-response.dto';

export function toErpBranchResponse(entity: ErpBranch): ErpBranchResponseDto {
  return {
    id: entity.id,
    extraData: entity.extraData ?? {},
    code: entity.code,
    name: entity.name,
    address: entity.address,
    isActive: entity.isActive,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
