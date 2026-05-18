import {
  Injectable,
  Inject,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateOpeningBalancesDto } from './dto/create-opening-balances.dto';
import { UpdateOpeningBalancesDto } from './dto/update-opening-balances.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
} from '../common/utils/directus-error.util';

@Injectable()
export class OpeningBalancesService {
  private readonly logger = new Logger(OpeningBalancesService.name);
  private readonly collection = 'opening_balances';

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

  async create(dto: CreateOpeningBalancesDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (createItem as any)(this.collection, { ...dto }),
      );
      return { message: 'Tạo số dư đầu kỳ thành công', data: result };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo số dư đầu kỳ', error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async findAll(query: PaginationDto, userToken: string) {
    this.guard(userToken);
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const sort = query.sort || '-created_at';
      const offset = (page - 1) * pageSize;
      const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');

      const url = new URL(`/items/${this.collection}`, directusUrl);
      url.searchParams.append('limit', pageSize.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('meta', 'filter_count');
      url.searchParams.append('filter[is_active][_eq]', 'true');
      url.searchParams.append('sort[]', sort);
      if (query.search) url.searchParams.append('search', query.search);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (!response.ok) {
        await throwDirectusResponseError(
          response,
          'Không thể lấy danh sách số dư đầu kỳ',
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
      this.logger.error('Lỗi khi lấy danh sách số dư đầu kỳ', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách số dư đầu kỳ',
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
      return { message: 'Lấy thông tin số dư đầu kỳ thành công', data: result };
    } catch (error: any) {
      this.logger.error(`Lỗi khi lấy thông tin số dư đầu kỳ ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể lấy thông tin số dư đầu kỳ',
      );
    }
  }

  async update(id: string, dto: UpdateOpeningBalancesDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, dto),
      );
      return { message: 'Cập nhật số dư đầu kỳ thành công', data: result };
    } catch (error: any) {
      this.logger.error(`Lỗi khi cập nhật số dư đầu kỳ ${id}`, error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async remove(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      await (client as any).request((updateItem as any)(this.collection, id, { is_active: false }));
      return { message: 'Xóa số dư đầu kỳ thành công' };
    } catch (error: any) {
      this.logger.error(`Lỗi khi xóa số dư đầu kỳ ${id}`, error);
      throw new InternalServerErrorException('Không thể xóa số dư đầu kỳ');
    }
  }
}
