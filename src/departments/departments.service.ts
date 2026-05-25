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
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
} from '../common/utils/directus-error.util';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);
  private readonly collection = 'erp_departments';

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: ReturnType<typeof createDirectus>,
    private readonly configService: ConfigService,
  ) {}

  async create(createDepartmentDto: CreateDepartmentDto, userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest());
    try {
      const result = await (userClient as any).request(
        (createItem as any)(this.collection, createDepartmentDto),
      );
      return { message: 'Tạo phòng ban thành công', data: result };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo phòng ban', error);
      const directusError = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${directusError}`);
    }
  }

  async findAll(query: PaginationDto, userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const sort = query.sort || '-created_at';
      const offset = (page - 1) * pageSize;

      const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
      const token = userToken;

      // Dùng native fetch để gọi thẳng REST API và lấy cả block "meta"
      const url = new URL(`/items/${this.collection}`, directusUrl);
      url.searchParams.append('limit', pageSize.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('meta', 'filter_count');
      url.searchParams.append('filter[is_active][_eq]', 'true');
      url.searchParams.append('sort[]', sort);
      if (query.search) {
        url.searchParams.append('search', query.search);
      }

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        await throwDirectusResponseError(
          response,
          'Không thể lấy danh sách phòng ban',
        );
      }

      const result = await response.json();
      const total = result.meta?.filter_count || 0;
      const totalPages = Math.ceil(total / pageSize);

      // Format chuẩn PaginatedResponse
      return {
        items: result.data || [],
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách phòng ban', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách phòng ban',
      );
    }
  }

  async findOne(id: string, userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest());
    try {
      const result = await (userClient as any).request(
        (readItem as any)(this.collection, id),
      );
      return { message: 'Lấy thông tin phòng ban thành công', data: result };
    } catch (error: any) {
      this.logger.error(`Lỗi khi lấy thông tin phòng ban ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể lấy thông tin phòng ban',
      );
    }
  }

  async update(
    id: string,
    updateDepartmentDto: UpdateDepartmentDto,
    userToken: string,
  ) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest());
    try {
      const result = await (userClient as any).request(
        (updateItem as any)(this.collection, id, updateDepartmentDto),
      );
      return { message: 'Cập nhật phòng ban thành công', data: result };
    } catch (error: any) {
      this.logger.error(`Lỗi khi cập nhật phòng ban ${id}`, error);
      const directusError = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${directusError}`);
    }
  }

  async remove(id: string, userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest());
    try {
      await (userClient as any).request(
        (updateItem as any)(this.collection, id, { is_active: false }),
      );
      return { message: 'Xóa phòng ban thành công' };
    } catch (error: any) {
      this.logger.error(`Lỗi khi xóa phòng ban ${id}`, error);
      throw new InternalServerErrorException('Không thể xóa phòng ban');
    }
  }
}
