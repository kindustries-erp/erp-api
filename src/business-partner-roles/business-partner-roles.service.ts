import { ConfigService } from '@nestjs/config';
import { PaginationDto } from '../common/dto/pagination.dto';

import {
  UnauthorizedException,
  Injectable,
  Inject,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  createDirectus,
  readItem,
  createItem,
  updateItem,
  deleteItem,
  rest,
  staticToken,
} from '@directus/sdk';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { CreateBusinessPartnerRoleDto } from './dto/create-business-partner-role.dto';
import { UpdateBusinessPartnerRoleDto } from './dto/update-business-partner-role.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
} from '../common/utils/directus-error.util';

@Injectable()
export class BusinessPartnerRolesService {
  private readonly logger = new Logger(BusinessPartnerRolesService.name);
  private readonly collection = 'business_partner_roles';

  // Fields thực tế trong Directus: id, business_partner_id, role, is_default, is_active, note, created_at
  private readonly VALID_SORT_FIELDS = [
    'id',
    '-id',
    'business_partner_id',
    '-business_partner_id',
    'role',
    '-role',
    'is_default',
    '-is_default',
    'is_active',
    '-is_active',
    'created_at',
    '-created_at',
  ];

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: ReturnType<typeof createDirectus>,
    private readonly configService: ConfigService,
  ) {}

  private getClient(userToken: string) {
    const url = this.configService.getOrThrow<string>('DIRECTUS_URL');
    return createDirectus(url).with(staticToken(userToken)).with(rest());
  }

  private guard(userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
  }

  async create(dto: CreateBusinessPartnerRoleDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (createItem as any)(this.collection, { ...dto }),
      );
      return { message: 'Tạo vai trò đối tác thành công', data: result };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo vai trò đối tác', error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async findAll(query: PaginationDto, userToken: string) {
    this.guard(userToken);
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const offset = (page - 1) * pageSize;

      // Sanitize sort — reject unknown fields để tránh Directus FORBIDDEN error
      const requestedSort = query.sort || '-created_at';
      const sort = this.VALID_SORT_FIELDS.includes(requestedSort)
        ? requestedSort
        : '-created_at';
      if (sort !== requestedSort) {
        this.logger.warn(
          `Invalid sort field "${requestedSort}" for ${this.collection}, falling back to "${sort}"`,
        );
      }

      const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
      const url = new URL(`/items/${this.collection}`, directusUrl);
      url.searchParams.append('limit', pageSize.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('meta', 'filter_count');
      url.searchParams.append('sort[]', sort);
      if (query.search) {
        url.searchParams.append('search', query.search);
      }

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      if (!response.ok) {
        await throwDirectusResponseError(
          response,
          'Không thể lấy danh sách vai trò đối tác',
        );
      }

      const result = await response.json();
      const total = result.meta?.filter_count || 0;

      return {
        items: result.data || [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách vai trò đối tác', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        `Không thể lấy danh sách vai trò đối tác: ${error.message}`,
      );
    }
  }

  async findOne(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (readItem as any)(this.collection, id),
      );
      return {
        message: 'Lấy thông tin vai trò đối tác thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi lấy thông tin vai trò đối tác ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể lấy thông tin vai trò đối tác',
      );
    }
  }

  async update(
    id: string,
    dto: UpdateBusinessPartnerRoleDto,
    userToken: string,
  ) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, dto),
      );
      return { message: 'Cập nhật vai trò đối tác thành công', data: result };
    } catch (error: any) {
      this.logger.error(`Lỗi khi cập nhật vai trò đối tác ${id}`, error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async remove(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      await (client as any).request((deleteItem as any)(this.collection, id));
      return { message: 'Xóa vai trò đối tác thành công' };
    } catch (error: any) {
      this.logger.error(`Lỗi khi xóa vai trò đối tác ${id}`, error);
      throw new InternalServerErrorException('Không thể xóa vai trò đối tác');
    }
  }
}
