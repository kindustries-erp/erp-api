import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchQueryDto } from './dto/branch-query.dto';
import { DirectusClient, RestClient, readItems, createItem, updateItem, deleteItem, readItem } from '@directus/sdk';
import { throwDirectusResponseError } from '../common/utils/directus-error.util';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(@Inject(DIRECTUS_CLIENT) private readonly directus: DirectusClient<any> & RestClient<any>) {}

  async create(createBranchDto: CreateBranchDto, token?: string) {
    try {
      const existingBranch = await this.directus.request(
        readItems('branches', {
          filter: { code: { _eq: createBranchDto.code } },
        })
      );
      if (existingBranch && existingBranch.length > 0) {
          throw new BadRequestException(`Branch code ${createBranchDto.code} already exists`);
      }

      const result = await this.directus.request(
        createItem('branches', createBranchDto as any)
      );
      return result;
    } catch (error) {
      this.logger.error(`Error creating branch: ${error.message}`);
      throwDirectusResponseError(error, 'Failed to create branch');
    }
  }

  async findAll(query: BranchQueryDto, token?: string) {
    try {
      const filter: any = {};

      if (query.is_active !== undefined) {
        filter.is_active = { _eq: query.is_active };
      }

      if (query.search) {
        filter._or = [
          { code: { _icontains: query.search } },
          { name: { _icontains: query.search } },
        ];
      }

      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 100;
      const offset = (page - 1) * pageSize;

      const allowedSortFields = new Set(['code', 'name', 'created_at', 'id']);
      const safeSortField = allowedSortFields.has(query.sort ?? '') ? (query.sort as string) : 'code';
      const safeOrder = query.order === 'desc' ? 'desc' : 'asc';
      const sort = [`${safeOrder === 'desc' ? '-' : ''}${safeSortField}`];

      const result = await this.directus.request(
        readItems('branches', {
          filter,
          sort,
          limit: pageSize,
          offset,
          meta: ['filter_count'],
        })
      );

      const items = (result as any)?.data ?? result;
      const total = (result as any)?.meta?.filter_count ?? (Array.isArray(items) ? items.length : 0);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      return {
        items,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      this.logger.error(`Error fetching branches: ${error.message}`);
      throwDirectusResponseError(error, 'Failed to fetch branches');
    }
  }

  async findOne(id: number, token?: string) {
    try {
      const result = await this.directus.request(
        readItem('branches', id)
      );
      if (!result) {
        throw new NotFoundException(`Branch #${id} not found`);
      }
      return result;
    } catch (error) {
      this.logger.error(`Error fetching branch ${id}: ${error.message}`);
      if (error instanceof NotFoundException) throw error;
      throwDirectusResponseError(error, 'Failed to fetch branch');
    }
  }

  async update(id: number, updateBranchDto: UpdateBranchDto, token?: string) {
    try {
      if (updateBranchDto.code) {
           const existingBranch = await this.directus.request(
              readItems('branches', {
                filter: { 
                    code: { _eq: updateBranchDto.code },
                    id: { _neq: id }
                },
              })
            );
            if (existingBranch && existingBranch.length > 0) {
                throw new BadRequestException(`Branch code ${updateBranchDto.code} already exists`);
            }
      }

      const result = await this.directus.request(
        updateItem('branches', id, updateBranchDto as any)
      );
      return result;
    } catch (error) {
      this.logger.error(`Error updating branch ${id}: ${error.message}`);
      throwDirectusResponseError(error, 'Failed to update branch');
    }
  }

  async remove(id: number, token?: string) {
    try {
      await this.directus.request(deleteItem('branches', id));
      return { success: true, id };
    } catch (error) {
      this.logger.error(`Error deleting branch ${id}: ${error.message}`);
      throwDirectusResponseError(error, 'Failed to delete branch');
    }
  }
}
