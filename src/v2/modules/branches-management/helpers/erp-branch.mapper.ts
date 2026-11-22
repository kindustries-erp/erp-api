import { BranchManagement } from '../entities/branch-management.entity';
import { ErpBranchResponseDto } from '../dto/erp-branch-response.dto';

export function toErpBranchResponse(
  entity: BranchManagement,
): ErpBranchResponseDto {
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
