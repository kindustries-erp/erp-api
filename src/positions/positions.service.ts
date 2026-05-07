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
  RestClient,
  StaticTokenClient,
} from '@directus/sdk';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
} from '../common/utils/directus-error.util';

type DirectusClientType = ReturnType<typeof createDirectus> &
  RestClient<any> &
  StaticTokenClient<any>;

interface DirectusError {
  errors: { message: string }[];
}

@Injectable()
export class PositionsService {
  private readonly logger = new Logger(PositionsService.name);
  private readonly collection = 'gw_positions';

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: DirectusClientType,
    private readonly configService: ConfigService,
  ) {}

  async create(createPositionDto: CreatePositionDto, userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest()) as DirectusClientType;
    try {
      const result = await userClient.request(
        createItem(this.collection, createPositionDto),
      );
      return { message: 'Tạo chức danh thành công', data: result };
    } catch (error: unknown) {
      this.logger.error('Lỗi khi tạo chức danh', error);
      const directusError =
        (error as DirectusError)?.errors?.[0]?.message ||
        (error as Error).message;
      throw new BadRequestException(`Lỗi: ${directusError}`);
    }
  }

  async findAll(query: PaginationDto, userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const sort = query.sort || '-created_at';
      const offset = (page - 1) * pageSize;

      const token = userToken;

      // Dùng native fetch để gọi thẳng REST API và lấy cả block "meta"
      const url = new URL(`/items/${this.collection}`, directusUrl);
      url.searchParams.append('limit', pageSize.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('meta', 'filter_count');
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
          'Không thể lấy danh sách chức danh',
        );
      }

      const result = (await response.json()) as {
        data: any[];
        meta?: { filter_count?: number };
      };
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
    } catch (error: unknown) {
      this.logger.error('Lỗi khi lấy danh sách chức danh', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách chức danh',
      );
    }
  }

  async findOne(id: string, userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest()) as DirectusClientType;
    try {
      const result = await userClient.request(readItem(this.collection, id));
      return { message: 'Lấy thông tin chức danh thành công', data: result };
    } catch (error: unknown) {
      this.logger.error(`Lỗi khi lấy thông tin chức danh ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể lấy thông tin chức danh',
      );
    }
  }

  async update(
    id: string,
    updatePositionDto: UpdatePositionDto,
    userToken: string,
  ) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest()) as DirectusClientType;
    try {
      const result = await userClient.request(
        updateItem(this.collection, id, updatePositionDto),
      );
      return { message: 'Cập nhật chức danh thành công', data: result };
    } catch (error: unknown) {
      this.logger.error(`Lỗi khi cập nhật chức danh ${id}`, error);
      const directusError =
        (error as DirectusError)?.errors?.[0]?.message ||
        (error as Error).message;
      throw new BadRequestException(`Lỗi: ${directusError}`);
    }
  }

  async remove(id: string, userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest()) as DirectusClientType;
    try {
      await userClient.request(deleteItem(this.collection, id));
      return { message: 'Xóa chức danh thành công' };
    } catch (error: unknown) {
      this.logger.error(`Lỗi khi xóa chức danh ${id}`, error);
      throw new InternalServerErrorException('Không thể xóa chức danh');
    }
  }
}
