import { BankManagement } from '../entities/bank-management.entity';
import { BankManagementResponseDto } from '../dto/bank-management-response.dto';

export function toBankManagementResponse(
  entity: BankManagement,
): BankManagementResponseDto {
  return {
    id: entity.id,
    code: entity.code,
    shortName: entity.shortName,
    name: entity.name,
    bin: entity.bin,
    logoUrl: entity.logoUrl ?? null,
    aliases: entity.aliases ?? [],
    isActive: entity.isActive,
    transferSupported: entity.transferSupported,
    lookupSupported: entity.lookupSupported,
    syncedAt: entity.syncedAt ?? null,
    extraData: entity.extraData ?? {},
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
