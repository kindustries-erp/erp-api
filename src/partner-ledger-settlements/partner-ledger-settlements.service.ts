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
import { CreatePartnerLedgerSettlementDto } from './dto/create-partner-ledger-settlement.dto';
import { PartnerLedgerSettlementQueryDto } from './dto/partner-ledger-settlement-query.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
  throwDirectusSdkError,
} from '../common/utils/directus-error.util';

@Injectable()
export class PartnerLedgerSettlementsService {
  private readonly logger = new Logger(PartnerLedgerSettlementsService.name);
  private readonly collection = 'partner_ledger_settlements';

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: ReturnType<typeof createDirectus>,
    private readonly configService: ConfigService,
  ) {}

  private get directusUrl() {
    return this.configService.getOrThrow<string>('DIRECTUS_URL');
  }

  private getClient(userToken: string) {
    return createDirectus(this.directusUrl)
      .with(staticToken(userToken))
      .with(rest());
  }

  private guard(userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
  }

  private async getCurrentUserId(userToken: string): Promise<string> {
    const res = await fetch(`${this.directusUrl}/users/me?fields=id`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (!res.ok)
      throw new UnauthorizedException('Không xác thực được người dùng');
    const { data } = await res.json();
    return data.id;
  }

  async create(dto: CreatePartnerLedgerSettlementDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    const createdBy = await this.getCurrentUserId(userToken);
    try {
      const result = await (client as any).request(
        (createItem as any)(this.collection, { ...dto, created_by: createdBy }),
      );
      return { message: 'Tạo bù trừ công nợ thành công', data: result };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo bù trừ công nợ', error);
      // DB trigger may reject with a descriptive message – surface it as 400
      const msg =
        error?.errors?.[0]?.message ||
        error?.message ||
        'Không thể tạo bù trừ công nợ';
      throw new BadRequestException(msg);
    }
  }

  async findAll(query: PartnerLedgerSettlementQueryDto, userToken: string) {
    this.guard(userToken);
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const sort = query.sort || '-created_at';
      const offset = (page - 1) * pageSize;

      const url = new URL(`/items/${this.collection}`, this.directusUrl);
      url.searchParams.append('limit', pageSize.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('meta', 'filter_count');
      url.searchParams.append('filter[is_active][_eq]', 'true');
      url.searchParams.append('sort[]', sort);

      const filterAnd: any[] = [];
      if (query.partner_ledger_item_id)
        filterAnd.push({
          partner_ledger_item_id: { _eq: query.partner_ledger_item_id },
        });
      if (query.payment_voucher_id)
        filterAnd.push({
          payment_voucher_id: { _eq: query.payment_voucher_id },
        });

      if (filterAnd.length > 0) {
        url.searchParams.append('filter', JSON.stringify({ _and: filterAnd }));
      }

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      if (!response.ok) {
        await throwDirectusResponseError(
          response,
          'Không thể lấy danh sách bù trừ công nợ',
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
      this.logger.error('Lỗi khi lấy danh sách bù trừ công nợ', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        `Không thể lấy danh sách bù trừ công nợ: ${error.message}`,
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
        message: 'Lấy thông tin bù trừ công nợ thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi lấy thông tin bù trừ công nợ ${id}`, error);
      throwDirectusSdkError(error, `Không tìm thấy bù trừ công nợ: ${id}`);
    }
  }

  async remove(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      await (client as any).request((updateItem as any)(this.collection, id, { is_active: false }));
      return { message: 'Xóa bù trừ công nợ thành công' };
    } catch (error: any) {
      this.logger.error(`Lỗi khi xóa bù trừ công nợ ${id}`, error);
      throwDirectusSdkError(error, 'Không thể xóa bù trừ công nợ');
    }
  }
}
