import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository, SelectQueryBuilder } from 'typeorm';
import { applyMultiKeywordFilter } from '@/common/utils/query-builder.util';
import {
  applyDateBounds,
  applyTableFilters,
  applyTableSort,
  emptyOptionsPage,
  findTableColumnOptions,
  parseListFilterPayload,
  resolveTableColumn,
  type TableColumnMap,
  type TableOptionsPage,
} from '@/common/utils/table-query';
import type { FileOwnerType } from '@/v2/core/file-attachments-core';
import { FileAttachment } from '../entities/file-attachment.entity';
import type { QueryFileAttachmentDto } from '../dto/query-file-attachment.dto';

/** Cột lọc, sắp xếp (whitelist). */
const TABLE_COLUMNS: TableColumnMap = {
  fileName: { sql: 'f.fileName', type: 'text' },
  file_name: { sql: 'f.fileName', type: 'text' },
  ownerType: { sql: 'f.ownerType', type: 'status' },
  owner_type: { sql: 'f.ownerType', type: 'status' },
  category: { sql: 'f.category', type: 'status' },
  origin: { sql: 'f.origin', type: 'status' },
  mimeType: { sql: 'f.mimeType', type: 'text' },
  mime_type: { sql: 'f.mimeType', type: 'text' },
  fileSize: { sql: 'f.fileSize', type: 'number' },
  file_size: { sql: 'f.fileSize', type: 'number' },
  createdBy: { sql: 'f.createdBy', type: 'status' },
  created_by: { sql: 'f.createdBy', type: 'status' },
  createdAt: { sql: 'f.createdAt', type: 'date' },
  created_at: { sql: 'f.createdAt', type: 'date' },
  deletedAt: { sql: 'f.deletedAt', type: 'date' },
  deleted_at: { sql: 'f.deletedAt', type: 'date' },
};

export interface FileAttachmentPage {
  items: FileAttachment[];
  total: number;
  page: number;
  pageSize: number;
}

/** Đọc dữ liệu. Mọi truy vấn theo owner luôn khóa `owner_type + owner_id` (chặn IDOR). */
@Injectable()
export class FileAttachmentQueryService {
  constructor(
    @InjectRepository(FileAttachment)
    private readonly repo: Repository<FileAttachment>,
  ) {}

  /** File chưa xóa của một chứng từ, mới nhất trước. */
  async listByOwner(
    ownerType: FileOwnerType,
    ownerId: string,
  ): Promise<FileAttachment[]> {
    return this.repo.find({
      where: { ownerType, ownerId, isDeleted: false },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  }

  async countByOwner(
    ownerType: FileOwnerType,
    ownerId: string,
  ): Promise<number> {
    return this.repo.count({ where: { ownerType, ownerId, isDeleted: false } });
  }

  /** File chưa xóa của đúng chứng từ; sai owner hoặc đã xóa thì 404. */
  async getForOwner(
    ownerType: FileOwnerType,
    ownerId: string,
    attachmentId: string,
  ): Promise<FileAttachment> {
    const row = await this.repo.findOne({
      where: { id: attachmentId, ownerType, ownerId, isDeleted: false },
    });
    if (!row) throw new NotFoundException('Không tìm thấy tài liệu');
    return row;
  }

  /** Theo id, kể cả đã xóa mềm (trang quản lý, đã qua RBAC). */
  async getById(id: string): Promise<FileAttachment> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy tài liệu');
    return row;
  }

  /** Id file đã xóa mềm trước mốc `cutoff`, cũ nhất trước (cho job tự dọn). */
  async findDueForPurge(cutoff: Date, limit: number): Promise<string[]> {
    const rows = await this.repo.find({
      select: { id: true },
      where: { isDeleted: true, deletedAt: LessThan(cutoff) },
      order: { deletedAt: 'ASC', id: 'ASC' },
      take: limit,
    });
    return rows.map((r) => r.id);
  }

  async findAll(query: QueryFileAttachmentDto): Promise<FileAttachmentPage> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize) || 20));
    const qb = this.baseQuery(query.deleted === 'only');

    if (query.ownerType) {
      qb.andWhere('f.ownerType = :ownerType', { ownerType: query.ownerType });
    }
    if (query.ownerId) {
      qb.andWhere('f.ownerId = :ownerId', { ownerId: query.ownerId });
    }
    if (query.category) {
      qb.andWhere('f.category = :category', { category: query.category });
    }
    if (query.origin) {
      qb.andWhere('f.origin = :origin', { origin: query.origin });
    }
    if (query.createdBy) {
      qb.andWhere('f.createdBy = :createdBy', { createdBy: query.createdBy });
    }
    const keyword = query.search?.trim();
    if (keyword) {
      applyMultiKeywordFilter(qb, 'f.fileName', keyword, 'global_search');
    }

    applyTableFilters(
      qb,
      parseListFilterPayload(query),
      TABLE_COLUMNS,
      'filter',
    );
    applyDateBounds(qb, 'f.createdAt', query.date_from, query.date_to, 'range');
    applyTableSort(
      qb,
      query.sort,
      TABLE_COLUMNS,
      query.deleted === 'only'
        ? { sql: 'f.deletedAt', direction: 'DESC' }
        : { sql: 'f.createdAt', direction: 'DESC' },
      'f.id',
    );

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize };
  }

  async findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    query: {
      deleted?: 'only';
      column_filters?: unknown;
      column_search?: unknown;
      column_operators?: unknown;
      date_ranges?: unknown;
    },
  ): Promise<TableOptionsPage> {
    const def = resolveTableColumn(TABLE_COLUMNS, column);
    if (!def) return emptyOptionsPage(page, pageSize);
    const qb = this.baseQuery(query.deleted === 'only');
    applyTableFilters(
      qb,
      parseListFilterPayload(query),
      TABLE_COLUMNS,
      'col_opt',
      column,
    );
    return findTableColumnOptions(qb, def, search, page, pageSize);
  }

  private baseQuery(deletedOnly: boolean): SelectQueryBuilder<FileAttachment> {
    return this.repo
      .createQueryBuilder('f')
      .where('f.isDeleted = :isDeleted', { isDeleted: deletedOnly });
  }
}
