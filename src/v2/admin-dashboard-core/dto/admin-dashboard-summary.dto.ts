import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AdminDashboardQueryDto {
  @ApiPropertyOptional({ description: 'ID chi nhánh lọc dữ liệu' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Kỳ báo cáo: month | quarter | year' })
  @IsOptional()
  @IsString()
  period?: string;
}

export class AdminKpiItemDto {
  @ApiProperty()
  value: number;

  @ApiPropertyOptional()
  growthRate?: number;

  @ApiPropertyOptional()
  pendingCount?: number;
}

export class AdminKpiSummaryDto {
  @ApiProperty({ type: AdminKpiItemDto })
  revenue: AdminKpiItemDto;

  @ApiProperty({ type: AdminKpiItemDto })
  salesOrdersCount: AdminKpiItemDto;

  @ApiProperty({ type: AdminKpiItemDto })
  inventoryLowStockCount: AdminKpiItemDto;

  @ApiProperty({ type: AdminKpiItemDto })
  unpaidReceivables: AdminKpiItemDto;
}

export class AdminPendingApprovalDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  total: number;
}

export class AdminSystemHealthDto {
  @ApiProperty()
  activeUsers: number;

  @ApiProperty()
  lastSyncAt: string;
}

export class AdminDashboardSummaryResponseDto {
  @ApiProperty({ type: AdminKpiSummaryDto })
  kpis: AdminKpiSummaryDto;

  @ApiProperty({ type: [AdminPendingApprovalDto] })
  recentPendingApprovals: AdminPendingApprovalDto[];

  @ApiProperty({ type: AdminSystemHealthDto })
  systemHealth: AdminSystemHealthDto;
}
