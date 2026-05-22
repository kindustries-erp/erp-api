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
  readItems,
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
import { rethrowHttpException } from '../common/utils/directus-error.util';

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

  async findAll(query: PaginationDto & { role?: string }, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const sort = query.sort || '-created_at';
      const offset = (page - 1) * pageSize;

      const filter: Record<string, any> = {
        is_active: { _eq: true },
      };

      if (query.role) {
        const roleRows = await (client as any).request(
          (readItems as any)('business_partner_roles', {
            filter: {
              role: { _eq: query.role },
              is_active: { _eq: true },
            },
            fields: ['business_partner_id'],
            limit: -1,
          }),
        );

        const partnerIds = Array.from(
          new Set(
            (roleRows || [])
              .map((row: any) => row?.business_partner_id)
              .filter((id: unknown) => typeof id === 'string' && !!id),
          ),
        );

        if (!partnerIds.length) {
          return {
            items: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          };
        }

        filter.id = { _in: partnerIds };
      }

      if (query.search) {
        filter._or = [
          { code: { _icontains: query.search } },
          { name: { _icontains: query.search } },
          { display_name: { _icontains: query.search } },
          { tax_code: { _icontains: query.search } },
          { phone: { _icontains: query.search } },
          { email: { _icontains: query.search } },
        ];
      }

      const result: any[] = await (client as any).request(
        (readItems as any)(this.collection, {
          filter,
          limit: -1,
          sort: [sort],
        }),
      );

      const allItems = Array.isArray(result) ? result : [];
      const total = allItems.length;
      const items = allItems.slice(offset, offset + pageSize);

      return {
        items,
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
