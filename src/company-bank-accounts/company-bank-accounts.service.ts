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
  readItems,
  readItem,
  createItem,
  updateItem,
  deleteItem,
  rest,
  staticToken,
} from '@directus/sdk';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { CreateCompanyBankAccountDto } from './dto/create-company-bank-account.dto';
import { UpdateCompanyBankAccountDto } from './dto/update-company-bank-account.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
} from '../common/utils/directus-error.util';

@Injectable()
export class CompanyBankAccountsService {
  private readonly logger = new Logger(CompanyBankAccountsService.name);
  private readonly collection = 'company_bank_accounts';

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: ReturnType<typeof createDirectus>,
    private readonly configService: ConfigService,
  ) {}

  async create(
    createCompanyBankAccountDto: CreateCompanyBankAccountDto,
    userToken: string,
  ) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest());
    try {
      const result = await (userClient as any).request(
        (createItem as any)(this.collection, createCompanyBankAccountDto),
      );
      return {
        message: 'Tạo tài khoản ngân hàng công ty thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo tài khoản ngân hàng công ty', error);
      const directusError = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${directusError}`);
    }
  }

  async findAll(query: PaginationDto, userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest());
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
          'Không thể lấy danh sách tài khoản ngân hàng',
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
      this.logger.error('Lỗi khi lấy danh sách tài khoản ngân hàng', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách tài khoản ngân hàng',
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
        message: 'Lấy thông tin tài khoản ngân hàng công ty thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(
        `Lỗi khi lấy thông tin tài khoản ngân hàng công ty ${id}`,
        error,
      );
      throw new InternalServerErrorException(
        'Không thể lấy thông tin tài khoản ngân hàng công ty',
      );
    }
  }

  async update(
    id: string,
    updateCompanyBankAccountDto: UpdateCompanyBankAccountDto,
    userToken: string,
  ) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const userClient = createDirectus(directusUrl)
      .with(staticToken(userToken))
      .with(rest());
    try {
      const result = await (userClient as any).request(
        (updateItem as any)(this.collection, id, updateCompanyBankAccountDto),
      );
      return {
        message: 'Cập nhật tài khoản ngân hàng công ty thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(
        `Lỗi khi cập nhật tài khoản ngân hàng công ty ${id}`,
        error,
      );
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
        (deleteItem as any)(this.collection, id),
      );
      return { message: 'Xóa tài khoản ngân hàng công ty thành công' };
    } catch (error: any) {
      this.logger.error(`Lỗi khi xóa tài khoản ngân hàng công ty ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể xóa tài khoản ngân hàng công ty',
      );
    }
  }
}
