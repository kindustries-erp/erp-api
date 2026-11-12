import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
/** Hình dạng response của API rbac-core: `items` và `pagination` (chuẩn v2). */
import type { PaginationMeta } from '@/common/utils/paginated-result';

export interface RoleUserResponse {
  id: string;
  email: string;
}

/** Một dòng trong danh sách role (GET roles). */
export interface RoleListItemResponse {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  createdAt: Date;
  users: RoleUserResponse[];
}

/** Role sau khi tạo/cập nhật (POST/PATCH roles). */
export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionResponse {
  id: string;
  roleId: string;
  resource: string;
  action: string;
  conditions: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleListResponse {
  items: RoleListItemResponse[];
  pagination: PaginationMeta;
}

/** Swagger của response danh sách role: `items` và `pagination`. */
export class RoleListResponseDto {
  @ApiProperty({ type: () => [RoleListItemResponseDto] })
  items: RoleListItemResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination: PaginationMetaDto;
}

/** Swagger của một dòng role trong danh sách. */
export class RoleListItemResponseDto {
  @ApiProperty({ example: 'b7a1c2d3-0000-4000-8000-000000000000' })
  id: string;

  @ApiProperty({ example: 'Quản trị' })
  name: string;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: () => [Object] })
  users: RoleUserResponse[];
}
