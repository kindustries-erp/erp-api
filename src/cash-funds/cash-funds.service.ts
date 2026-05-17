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
import { CreateCashFundsDto } from './dto/create-cash-funds.dto';
import { UpdateCashFundsDto } from './dto/update-cash-funds.dto';
import { rethrowHttpException } from '../common/utils/directus-error.util';

@Injectable()
export class CashFundsService {
  private readonly logger = new Logger(CashFundsService.name);
  private readonly collection = 'cash_funds';

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

  async create(dto: CreateCashFundsDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (createItem as any)(this.collection, { ...dto }),
      );
      return { message: 'Tạo quỹ tiền mặt thành công', data: result };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo quỹ tiền mặt', error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async findAll(query: PaginationDto, userToken: string) {
    this.guard(userToken);
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const allowedSortFields = new Set(['created_at', 'updated_at', 'fund_code', 'fund_name']);
      const requestedSort = query.sort || '-created_at';
      const normalizedSortField = requestedSort.replace(/^-/, '');
      const sort = allowedSortFields.has(normalizedSortField)
        ? requestedSort
        : '-created_at';
      const offset = (page - 1) * pageSize;
      const client = this.getClient(userToken);
      const result = await (client as any).request(
        (readItems as any)(this.collection, {
          limit: pageSize,
          offset,
          sort: [sort],
          search: query.search,
          meta: 'filter_count',
        }),
      );

      const total = Number(result?.meta?.filter_count ?? 0);
      return {
        items: Array.isArray(result?.data) ? result.data : [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách quỹ tiền mặt', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách quỹ tiền mặt',
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
      return { message: 'Lấy thông tin quỹ tiền mặt thành công', data: result };
    } catch (error: any) {
      this.logger.error(`Lỗi khi lấy thông tin quỹ tiền mặt ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể lấy thông tin quỹ tiền mặt',
      );
    }
  }

  async update(id: string, dto: UpdateCashFundsDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, dto),
      );
      return { message: 'Cập nhật quỹ tiền mặt thành công', data: result };
    } catch (error: any) {
      this.logger.error(`Lỗi khi cập nhật quỹ tiền mặt ${id}`, error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async remove(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      await (client as any).request((deleteItem as any)(this.collection, id));
      return { message: 'Xóa quỹ tiền mặt thành công' };
    } catch (error: any) {
      this.logger.error(`Lỗi khi xóa quỹ tiền mặt ${id}`, error);
      throw new InternalServerErrorException('Không thể xóa quỹ tiền mặt');
    }
  }
}
