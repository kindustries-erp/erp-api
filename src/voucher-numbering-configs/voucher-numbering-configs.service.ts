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
  RestClient,
  StaticTokenClient,
} from '@directus/sdk';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateVoucherNumberingConfigsDto } from './dto/create-voucher-numbering-configs.dto';
import { UpdateVoucherNumberingConfigsDto } from './dto/update-voucher-numbering-configs.dto';
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
export class VoucherNumberingConfigsService {
  private readonly logger = new Logger(VoucherNumberingConfigsService.name);
  private readonly collection = 'voucher_numbering_configs';

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: DirectusClientType,
    private readonly configService: ConfigService,
  ) {}

  private getClient(userToken: string): DirectusClientType {
    const url = this.configService.getOrThrow<string>('DIRECTUS_URL');
    return createDirectus(url)
      .with(staticToken(userToken))
      .with(rest()) as DirectusClientType;
  }

  private guard(userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
  }

  async create(dto: CreateVoucherNumberingConfigsDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await client.request(
        createItem(this.collection, { ...dto }),
      );
      return { message: 'Tạo cấu hình đánh số phiếu thành công', data: result };
    } catch (error: unknown) {
      this.logger.error('Lỗi khi tạo cấu hình đánh số phiếu', error);
      const msg =
        (error as DirectusError)?.errors?.[0]?.message ||
        (error as Error).message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async findAll(query: PaginationDto, userToken: string) {
    this.guard(userToken);
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const sort = query.sort || 'voucher_type';
      const offset = (page - 1) * pageSize;
      const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');

      const url = new URL(`/items/${this.collection}`, directusUrl);
      url.searchParams.append('limit', pageSize.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('meta', 'filter_count');
      url.searchParams.append('sort[]', sort);
      if (query.search) url.searchParams.append('search', query.search);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (!response.ok) {
        await throwDirectusResponseError(
          response,
          'Không thể lấy danh sách cấu hình đánh số phiếu',
        );
      }

      const result = (await response.json()) as {
        data: any[];
        meta?: { filter_count?: number };
      };
      const total = result.meta?.filter_count || 0;
      return {
        items: result.data || [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: unknown) {
      this.logger.error('Lỗi khi lấy danh sách cấu hình đánh số phiếu', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách cấu hình đánh số phiếu',
      );
    }
  }

  async findOne(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await client.request(readItem(this.collection, id));
      return {
        message: 'Lấy thông tin cấu hình đánh số phiếu thành công',
        data: result,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Lỗi khi lấy thông tin cấu hình đánh số phiếu ${id}`,
        error,
      );
      throw new InternalServerErrorException(
        'Không thể lấy thông tin cấu hình đánh số phiếu',
      );
    }
  }

  async update(
    id: string,
    dto: UpdateVoucherNumberingConfigsDto,
    userToken: string,
  ) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await client.request(updateItem(this.collection, id, dto));
      return {
        message: 'Cập nhật cấu hình đánh số phiếu thành công',
        data: result,
      };
    } catch (error: unknown) {
      this.logger.error(`Lỗi khi cập nhật cấu hình đánh số phiếu ${id}`, error);
      const msg =
        (error as DirectusError)?.errors?.[0]?.message ||
        (error as Error).message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async remove(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      await client.request(deleteItem(this.collection, id));
      return { message: 'Xóa cấu hình đánh số phiếu thành công' };
    } catch (error: unknown) {
      this.logger.error(`Lỗi khi xóa cấu hình đánh số phiếu ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể xóa cấu hình đánh số phiếu',
      );
    }
  }
}
