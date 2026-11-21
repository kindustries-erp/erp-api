import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CoreRole } from '@/v2/core/rbac-core/entities/core-role.entity';
import { applyMultiKeywordFilter } from '@/common/utils/query-builder.util';
import {
  buildPagination,
  PaginationMeta,
} from '@/common/utils/paginated-result';
import { ListCoreRolesDto } from '../dto/rbac-core.dto';
import type {
  RoleListResponse,
  RoleListItemResponse,
  RoleResponse,
} from '../dto/rbac-response.dto';
import {
  applyRoleColumnFilters,
  applyRoleColumnSearch,
  applyRoleCrossColumnFilters,
  applyRoleDateRange,
  applyRoleGlobalSearch,
  applyRoleSorts,
  mapRoleColumnToSqlField,
} from '../helpers/role-table-filter.helper';
import { toRoleListItem, toRoleResponse } from '../helpers/rbac-role.mapper';
import {
  canViewTestAccounts,
  HIDDEN_TEST_ROLE_NAMES,
  isHiddenTestRoleName,
} from '@/v2/core/users-core';

/** Ẩn role test khỏi danh sách và gợi ý cột với người không có quyền. */
function applyHiddenRoleFilter(
  qb: SelectQueryBuilder<CoreRole>,
  viewerEmail?: string | null,
): void {
  if (canViewTestAccounts(viewerEmail)) return;
  qb.andWhere('role.name NOT IN (:...hiddenRoleNames)', {
    hiddenRoleNames: [...HIDDEN_TEST_ROLE_NAMES],
  });
}

export interface RoleColumnOptionsResponse {
  items: { label: string; value: string }[];
  pagination: PaginationMeta;
}

/** Truy vấn chỉ đọc cho role: danh sách phân trang và danh sách giá trị cột. */
@Injectable()
export class RoleQueryService {
  constructor(
    @InjectRepository(CoreRole)
    private readonly roleRepository: Repository<CoreRole>,
  ) {}

  async getRolesPaginated(
    query: ListCoreRolesDto,
    viewerEmail?: string | null,
  ): Promise<RoleListResponse> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);

    const qb = this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.userRoles', 'ur')
      .leftJoinAndSelect('ur.user', 'user');
    applyHiddenRoleFilter(qb, viewerEmail);

    applyRoleGlobalSearch(qb, query.search);
    applyRoleColumnSearch(qb, query.column_search);
    applyRoleColumnFilters(qb, query.column_filters);
    applyRoleDateRange(qb, query.date_from, query.date_to);
    applyRoleSorts(qb, query.sorts);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    const mappedItems: RoleListItemResponse[] = items.map(toRoleListItem);

    return {
      items: mappedItems,
      pagination: buildPagination(page, pageSize, total),
    };
  }

  async getColumnOptions(
    column: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    viewerEmail?: string | null,
  ): Promise<RoleColumnOptionsResponse> {
    const rawSqlField = mapRoleColumnToSqlField(column);
    if (!rawSqlField) {
      return { items: [], pagination: buildPagination(page, pageSize, 0) };
    }

    const qb = this.roleRepository.createQueryBuilder('role');
    applyHiddenRoleFilter(qb, viewerEmail);
    applyRoleCrossColumnFilters(qb, column, filtersStr);

    qb.select(`${rawSqlField}`, 'value');
    qb.addSelect('COUNT(*)', 'count');
    qb.andWhere(
      `${rawSqlField} IS NOT NULL AND CAST(${rawSqlField} AS text) != ''`,
    );

    if (search && search.trim()) {
      applyMultiKeywordFilter(qb, rawSqlField, search.trim(), 'col_opt_search');
    }

    qb.groupBy(`${rawSqlField}`);
    qb.orderBy(`${rawSqlField}`, 'ASC');

    const countQb = qb.clone();
    const totalRaw = await countQb.getRawMany();
    const total = totalRaw.length;

    qb.offset((page - 1) * pageSize).limit(pageSize);
    const rows = await qb.getRawMany();

    const isStatusColumn =
      column === 'isActive' || column === 'is_active' || column === 'status';
    const items = rows.map((r) => {
      const label = isStatusColumn
        ? r.value === true || r.value === 'true'
          ? 'Hoạt động'
          : 'Ngưng'
        : String(r.value);
      return { label, value: String(r.value) };
    });

    return { items, pagination: buildPagination(page, pageSize, total) };
  }

  /** Role test với người không có quyền trả 404 như không tồn tại. */
  async getRoleById(
    id: string,
    viewerEmail?: string | null,
  ): Promise<RoleResponse> {
    const role = await this.roleRepository.findOne({ where: { id } });
    const hidden =
      isHiddenTestRoleName(role?.name) && !canViewTestAccounts(viewerEmail);
    if (!role || hidden) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    return toRoleResponse(role);
  }
}
