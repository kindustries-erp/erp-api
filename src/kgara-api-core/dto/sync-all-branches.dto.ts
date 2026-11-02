import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export const KGARA_BULK_SYNC_SCOPES = [
  'all',
  'cases',
  'gross-profit',
  'case-details',
] as const;

export class SyncAllBranchesDto {
  @IsIn(KGARA_BULK_SYNC_SCOPES)
  scope: (typeof KGARA_BULK_SYNC_SCOPES)[number];

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsBoolean()
  includeDetails?: boolean;

  @IsOptional()
  @IsBoolean()
  forceDetails?: boolean;
}
