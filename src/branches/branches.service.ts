import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { ConfigService } from '@nestjs/config';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchQueryDto } from './dto/branch-query.dto';
import { DirectusClient, RestClient, readItems, createItem, updateItem, deleteItem, readItem } from '@directus/sdk';
import { createDirectus, rest, staticToken } from '@directus/sdk';
import { throwDirectusResponseError } from '../common/utils/directus-error.util';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(
    @Inject(DIRECTUS_CLIENT) private readonly directus: DirectusClient<any> & RestClient<any>,
    private readonly configService: ConfigService,
  ) {}

  private getUserClient(token: string) {
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    return createDirectus(directusUrl).with(staticToken(token)).with(rest());
  }

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
      if (!token) {
        throw new BadRequestException('Missing user token');
      }
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const offset = (page - 1) * pageSize;
      const allowedSortFields = new Set(['code', 'name', 'created_at', 'updated_at']);
      const requestedSort = (query as any).sort || 'code';
      const normalizedSortField = requestedSort.replace(/^-/, '');
      const sort = allowedSortFields.has(normalizedSortField) ? requestedSort : 'code';

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

      const userClient = this.getUserClient(token);
      const response = await (userClient as any).request(
        (readItems as any)('branches', {
          filter,
          sort: [sort],
          limit: pageSize,
          offset,
          meta: 'filter_count',
        })
      );

      const normalizedResponse: any = response;
      const items = Array.isArray(normalizedResponse) ? normalizedResponse : (normalizedResponse?.data ?? []);
      const total = Number(normalizedResponse?.meta?.filter_count ?? items.length ?? 0);
      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
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
