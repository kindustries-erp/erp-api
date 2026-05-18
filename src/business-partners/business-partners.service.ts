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
import { CreateBusinessPartnersDto } from './dto/create-business-partners.dto';
import { UpdateBusinessPartnersDto } from './dto/update-business-partners.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
} from '../common/utils/directus-error.util';

@Injectable()
export class BusinessPartnersService {
  private readonly logger = new Logger(BusinessPartnersService.name);
  private readonly collection = 'business_partners';

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

  async create(dto: CreateBusinessPartnersDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (createItem as any)(this.collection, { ...dto }),
      );
      return { message: 'Tạo đối tác kinh doanh thành công', data: result };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo đối tác kinh doanh', error);
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
          'Không thể lấy danh sách đối tác kinh doanh',
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
      this.logger.error('Lỗi khi lấy danh sách đối tác kinh doanh', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách đối tác kinh doanh',
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
        message: 'Lấy thông tin đối tác kinh doanh thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(
        `Lỗi khi lấy thông tin đối tác kinh doanh ${id}`,
        error,
      );
      throw new InternalServerErrorException(
        'Không thể lấy thông tin đối tác kinh doanh',
      );
    }
  }

  async update(id: string, dto: UpdateBusinessPartnersDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, dto),
      );
      return {
        message: 'Cập nhật đối tác kinh doanh thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi cập nhật đối tác kinh doanh ${id}`, error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async remove(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      await (client as any).request(
        (updateItem as any)(this.collection, id, { is_active: false }),
      );
      return { message: 'Xóa đối tác kinh doanh thành công' };
    } catch (error: any) {
      this.logger.error(`Lỗi khi xóa đối tác kinh doanh ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể xóa đối tác kinh doanh',
      );
    }
  }
}
