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
import { CreateChartOfAccountDto } from './dto/create-chart-of-account.dto';
import { UpdateChartOfAccountDto } from './dto/update-chart-of-account.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
} from '../common/utils/directus-error.util';

@Injectable()
export class ChartOfAccountsService {
  private readonly logger = new Logger(ChartOfAccountsService.name);
  private readonly collection = 'chart_of_accounts';

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: ReturnType<typeof createDirectus>,
    private readonly configService: ConfigService,
  ) {}

  async create(
    createChartOfAccountDto: CreateChartOfAccountDto,
    userToken: string,
  ) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest());
    try {
      const result = await (userClient as any).request(
        (createItem as any)(this.collection, createChartOfAccountDto),
      );
      return { message: 'Tạo tài khoản kế toán thành công', data: result };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo tài khoản kế toán', error);
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
          'Không thể lấy danh sách tài khoản kế toán',
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
      this.logger.error('Lỗi khi lấy danh sách tài khoản kế toán', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách tài khoản kế toán',
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
      return {
        message: 'Lấy thông tin tài khoản kế toán thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi lấy thông tin tài khoản kế toán ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể lấy thông tin tài khoản kế toán',
      );
    }
  }

  async update(
    id: string,
    updateChartOfAccountDto: UpdateChartOfAccountDto,
    userToken: string,
  ) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest());
    try {
      const result = await (userClient as any).request(
        (updateItem as any)(this.collection, id, updateChartOfAccountDto),
      );
      return { message: 'Cập nhật tài khoản kế toán thành công', data: result };
    } catch (error: any) {
      this.logger.error(`Lỗi khi cập nhật tài khoản kế toán ${id}`, error);
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
      return { message: 'Xóa tài khoản kế toán thành công' };
    } catch (error: any) {
      this.logger.error(`Lỗi khi xóa tài khoản kế toán ${id}`, error);
      throw new InternalServerErrorException('Không thể xóa tài khoản kế toán');
    }
  }
}
