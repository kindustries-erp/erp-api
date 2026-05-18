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
import { CreateBusinessPartnerBankAccountsDto } from './dto/create-business-partner-bank-accounts.dto';
import { UpdateBusinessPartnerBankAccountsDto } from './dto/update-business-partner-bank-accounts.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
} from '../common/utils/directus-error.util';

@Injectable()
export class BusinessPartnerBankAccountsService {
  private readonly logger = new Logger(BusinessPartnerBankAccountsService.name);
  private readonly collection = 'business_partner_bank_accounts';

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

  async create(dto: CreateBusinessPartnerBankAccountsDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (createItem as any)(this.collection, { ...dto }),
      );
      return {
        message: 'Tạo tài khoản ngân hàng đối tác thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo tài khoản ngân hàng đối tác', error);
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
          'Không thể lấy danh sách tài khoản ngân hàng đối tác',
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
      this.logger.error(
        'Lỗi khi lấy danh sách tài khoản ngân hàng đối tác',
        error,
      );
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách tài khoản ngân hàng đối tác',
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
        message: 'Lấy thông tin tài khoản ngân hàng đối tác thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(
        `Lỗi khi lấy thông tin tài khoản ngân hàng đối tác ${id}`,
        error,
      );
      throw new InternalServerErrorException(
        'Không thể lấy thông tin tài khoản ngân hàng đối tác',
      );
    }
  }

  async update(
    id: string,
    dto: UpdateBusinessPartnerBankAccountsDto,
    userToken: string,
  ) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, dto),
      );
      return {
        message: 'Cập nhật tài khoản ngân hàng đối tác thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(
        `Lỗi khi cập nhật tài khoản ngân hàng đối tác ${id}`,
        error,
      );
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
      return { message: 'Xóa tài khoản ngân hàng đối tác thành công' };
    } catch (error: any) {
      this.logger.error(`Lỗi khi xóa tài khoản ngân hàng đối tác ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể xóa tài khoản ngân hàng đối tác',
      );
    }
  }
}
