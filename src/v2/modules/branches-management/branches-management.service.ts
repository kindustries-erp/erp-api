import { toPagedList } from '@/common/utils/paginated-result';
import { Injectable } from '@nestjs/common';
import { PaginationDto } from '@/common/dto/pagination.dto';
import {
  CreateErpBranchInput,
  UpdateErpBranchInput,
} from './dto/create-erp-branch.dto';
import { toErpBranchResponse } from './helpers/erp-branch.mapper';
import { BranchManagementCommandService } from './services/branch-management-command.service';
import { BranchManagementQueryService } from './services/branch-management-query.service';

@Injectable()
export class BranchesManagementService {
  constructor(
    private readonly query: BranchManagementQueryService,
    private readonly command: BranchManagementCommandService,
  ) {}

  async findAll(query: PaginationDto) {
    const page = await this.query.findAll(query);
    return toPagedList(
      page.items.map((item) => toErpBranchResponse(item)),
      page.page,
      page.pageSize,
      page.total,
    );
  }

  async create(body: CreateErpBranchInput) {
    const result = await this.command.create(body);
    return { data: toErpBranchResponse(result.data), message: result.message };
  }

  async update(id: string, body: UpdateErpBranchInput) {
    const result = await this.command.update(id, body);
    return {
      data: result.data ? toErpBranchResponse(result.data) : null,
      message: result.message,
    };
  }

  remove(id: string) {
    return this.command.remove(id);
  }
}
