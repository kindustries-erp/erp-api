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
  rest,
  staticToken,
} from '@directus/sdk';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { CreatePartnerLedgerItemDto } from './dto/create-partner-ledger-item.dto';
import { UpdatePartnerLedgerItemDto } from './dto/update-partner-ledger-item.dto';
import { PartnerLedgerItemQueryDto } from './dto/partner-ledger-item-query.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
  throwDirectusSdkError,
} from '../common/utils/directus-error.util';

@Injectable()
export class PartnerLedgerItemsService {
  private readonly logger = new Logger(PartnerLedgerItemsService.name);
  private readonly collection = 'partner_ledger_items';

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

  async create(dto: CreatePartnerLedgerItemDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    const createdBy = await this.getCurrentUserId(userToken);
    try {
      const result = await (client as any).request(
        (createItem as any)(this.collection, { ...dto, created_by: createdBy }),
      );
      return { message: 'Tạo khoản công nợ thành công', data: result };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo khoản công nợ', error);
      throwDirectusSdkError(error, 'Không thể tạo khoản công nợ');
    }
  }

  async findAll(query: PartnerLedgerItemQueryDto, userToken: string) {
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
      url.searchParams.append('sort[]', sort);
      if (query.search) url.searchParams.append('search', query.search);

      const filterAnd: any[] = [];
      if (query.item_type)
        filterAnd.push({ item_type: { _eq: query.item_type } });
      if (query.business_partner_id)
        filterAnd.push({
          business_partner_id: { _eq: query.business_partner_id },
        });
      if (query.accounting_account_id)
        filterAnd.push({
          accounting_account_id: { _eq: query.accounting_account_id },
        });
      if (query.status) filterAnd.push({ status: { _eq: query.status } });
      if (query.due_from)
        filterAnd.push({ due_date: { _gte: query.due_from } });
      if (query.due_to) filterAnd.push({ due_date: { _lte: query.due_to } });
      if (query.overdue) {
        const today = new Date().toISOString().slice(0, 10);
        filterAnd.push({ due_date: { _lt: today } });
        filterAnd.push({ status: { _in: ['OPEN', 'PARTIAL'] } });
      }

      if (filterAnd.length > 0) {
        url.searchParams.append('filter', JSON.stringify({ _and: filterAnd }));
      }

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      if (!response.ok) {
        await throwDirectusResponseError(
          response,
          'Không thể lấy danh sách khoản công nợ',
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
      this.logger.error('Lỗi khi lấy danh sách khoản công nợ', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        `Không thể lấy danh sách khoản công nợ: ${error.message}`,
      );
    }
  }

  async getSummary(query: PartnerLedgerItemQueryDto, userToken: string) {
    this.guard(userToken);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const baseFilter: any[] = [];

      if (query.item_type)
        baseFilter.push({ item_type: { _eq: query.item_type } });
      if (query.business_partner_id)
        baseFilter.push({
          business_partner_id: { _eq: query.business_partner_id },
        });
      if (query.accounting_account_id)
        baseFilter.push({
          accounting_account_id: { _eq: query.accounting_account_id },
        });

      const fetchItems = async (extraFilter: any[] = []) => {
        const url = new URL(`/items/${this.collection}`, this.directusUrl);
        url.searchParams.append('limit', '-1');
        url.searchParams.append('fields[]', 'open_amount');
        url.searchParams.append('fields[]', 'settled_amount');
        url.searchParams.append('fields[]', 'status');
        url.searchParams.append('fields[]', 'due_date');

        const filter = [...baseFilter, ...extraFilter];
        if (filter.length > 0) {
          url.searchParams.append('filter', JSON.stringify({ _and: filter }));
        }

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        if (!res.ok)
          await throwDirectusResponseError(res, 'Không thể tính tổng công nợ');
        const json = await res.json();
        return (json.data || []) as Array<{
          open_amount: number;
          settled_amount: number;
          status: string;
          due_date: string | null;
        }>;
      };

      const allItems = await fetchItems();

      let total_open = 0;
      let total_overdue = 0;
      let total_settled = 0;
      const buckets = {
        current: 0,
        days_1_30: 0,
        days_31_60: 0,
        days_61_90: 0,
        days_90_plus: 0,
      };

      for (const item of allItems) {
        const open = Number(item.open_amount) || 0;
        const settled = Number(item.settled_amount) || 0;

        if (['OPEN', 'PARTIAL'].includes(item.status)) {
          total_open += open;

          if (item.due_date) {
            const daysOverdue = Math.floor(
              (new Date(today).getTime() - new Date(item.due_date).getTime()) /
                (1000 * 60 * 60 * 24),
            );
            if (daysOverdue > 0) {
              total_overdue += open;
              if (daysOverdue <= 30) buckets.days_1_30 += open;
              else if (daysOverdue <= 60) buckets.days_31_60 += open;
              else if (daysOverdue <= 90) buckets.days_61_90 += open;
              else buckets.days_90_plus += open;
            } else {
              buckets.current += open;
            }
          } else {
            buckets.current += open;
          }
        }

        if (item.status === 'SETTLED') {
          total_settled += settled;
        }
      }

      return {
        total_open,
        total_overdue,
        total_settled,
        total_count: allItems.length,
        buckets,
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy tổng hợp công nợ', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể tính tổng hợp công nợ');
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
        message: 'Lấy thông tin khoản công nợ thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi lấy thông tin khoản công nợ ${id}`, error);
      throwDirectusSdkError(error, `Không tìm thấy khoản công nợ: ${id}`);
    }
  }

  async update(id: string, dto: UpdatePartnerLedgerItemDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    const updatedBy = await this.getCurrentUserId(userToken);
    try {
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, {
          ...dto,
          updated_by: updatedBy,
        }),
      );
      return { message: 'Cập nhật khoản công nợ thành công', data: result };
    } catch (error: any) {
      this.logger.error(`Lỗi khi cập nhật khoản công nợ ${id}`, error);
      throwDirectusSdkError(error, 'Không thể cập nhật khoản công nợ');
    }
  }

  async remove(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);

    // Check if settlements exist before cancelling
    const checkUrl = new URL(
      `/items/partner_ledger_settlements`,
      this.directusUrl,
    );
    checkUrl.searchParams.append(
      'filter',
      JSON.stringify({ partner_ledger_item_id: { _eq: id } }),
    );
    checkUrl.searchParams.append('aggregate[count]', 'id');

    const checkRes = await fetch(checkUrl.toString(), {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    if (checkRes.ok) {
      const checkJson = await checkRes.json();
      const count = Number(checkJson.data?.[0]?.count?.id) || 0;
      if (count > 0) {
        throw new BadRequestException(
          'Không thể xóa khoản công nợ đã có thanh toán bù trừ. Hủy các bù trừ trước.',
        );
      }
    }

    // Soft cancel
    try {
      const updatedBy = await this.getCurrentUserId(userToken);
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, {
          status: 'CANCELLED',
          updated_by: updatedBy,
        }),
      );
      return { message: 'Đã hủy khoản công nợ', data: result };
    } catch (error: any) {
      this.logger.error(`Lỗi khi hủy khoản công nợ ${id}`, error);
      throwDirectusSdkError(error, 'Không thể hủy khoản công nợ');
    }
  }
}
