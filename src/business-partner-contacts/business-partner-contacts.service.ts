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
import { CreateBusinessPartnerContactsDto } from './dto/create-business-partner-contacts.dto';
import { UpdateBusinessPartnerContactsDto } from './dto/update-business-partner-contacts.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
} from '../common/utils/directus-error.util';

@Injectable()
export class BusinessPartnerContactsService {
  private readonly logger = new Logger(BusinessPartnerContactsService.name);
  private readonly collection = 'business_partner_contacts';

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

  async create(dto: CreateBusinessPartnerContactsDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (createItem as any)(this.collection, { ...dto }),
      );
      return { message: 'Tạo liên hệ đối tác thành công', data: result };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo liên hệ đối tác', error);
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
      url.searchParams.append('sort[]', sort);
      if (query.search) url.searchParams.append('search', query.search);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (!response.ok) {
        await throwDirectusResponseError(
          response,
          'Không thể lấy danh sách liên hệ đối tác',
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
      this.logger.error('Lỗi khi lấy danh sách liên hệ đối tác', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách liên hệ đối tác',
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
        message: 'Lấy thông tin liên hệ đối tác thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi lấy thông tin liên hệ đối tác ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể lấy thông tin liên hệ đối tác',
      );
    }
  }

  async update(
    id: string,
    dto: UpdateBusinessPartnerContactsDto,
    userToken: string,
  ) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, dto),
      );
      return { message: 'Cập nhật liên hệ đối tác thành công', data: result };
    } catch (error: any) {
      this.logger.error(`Lỗi khi cập nhật liên hệ đối tác ${id}`, error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async remove(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      await (client as any).request((deleteItem as any)(this.collection, id));
      return { message: 'Xóa liên hệ đối tác thành công' };
    } catch (error: any) {
      this.logger.error(`Lỗi khi xóa liên hệ đối tác ${id}`, error);
      throw new InternalServerErrorException('Không thể xóa liên hệ đối tác');
    }
  }
}
