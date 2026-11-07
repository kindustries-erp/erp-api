import { Injectable } from '@nestjs/common';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { BranchesCoreService } from '@/v2/core/branches-core';
import {
  CreateErpBranchInput,
  UpdateErpBranchInput,
} from './dto/create-erp-branch.dto';
import { toErpBranchResponse } from './helpers/erp-branch.mapper';

@Injectable()
export class BranchesManagementService {
  constructor(private readonly core: BranchesCoreService) {}

  async findAll(query: PaginationDto) {
    const page = await this.core.findAll(query);
    return {
      items: page.items.map((item) => toErpBranchResponse(item)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: page.totalPages,
    };
  }

  async create(body: CreateErpBranchInput) {
    const result = await this.core.create(body);
    return { data: toErpBranchResponse(result.data), message: result.message };
  }

  async update(id: string, body: UpdateErpBranchInput) {
    const result = await this.core.update(id, body);
    return {
      data: result.data ? toErpBranchResponse(result.data) : null,
      message: result.message,
    };
  }

  remove(id: string) {
    return this.core.remove(id);
  }
}
