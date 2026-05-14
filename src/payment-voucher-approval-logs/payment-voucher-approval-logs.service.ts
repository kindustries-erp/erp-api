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
import { CreatePaymentVoucherApprovalLogsDto } from './dto/create-payment-voucher-approval-logs.dto';
import { UpdatePaymentVoucherApprovalLogsDto } from './dto/update-payment-voucher-approval-logs.dto';
import { GetPaymentVoucherApprovalLogsDto } from './dto/get-payment-voucher-approval-logs.dto';
import {
  rethrowHttpException,
  throwDirectusSdkError,
} from '../common/utils/directus-error.util';

@Injectable()
export class PaymentVoucherApprovalLogsService {
  private readonly logger = new Logger(PaymentVoucherApprovalLogsService.name);
  private readonly collection = 'payment_voucher_approval_logs';

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: ReturnType<typeof createDirectus>,
    private readonly configService: ConfigService,
  ) {}

  private getClient(userToken: string) {
    const url = this.configService.getOrThrow<string>('DIRECTUS_URL');
    return createDirectus(url).with(staticToken(userToken)).with(rest());
  }

  private getAdminClient() {
    const url = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const token = this.configService.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');
    return createDirectus(url).with(staticToken(token)).with(rest());
  }

  private guard(userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
  }

  async create(dto: CreatePaymentVoucherApprovalLogsDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (createItem as any)(this.collection, { ...dto }),
      );
      return { message: 'Tạo nhật ký duyệt phiếu thành công', data: result };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo nhật ký duyệt phiếu', error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async findAll(query: GetPaymentVoucherApprovalLogsDto, userToken: string) {
    this.guard(userToken);
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const client = query.payment_voucher_id
        ? this.getAdminClient()
        : this.getClient(userToken);

      const filter: any = {};
      if (query.payment_voucher_id) {
        await (this.getClient(userToken) as any).request(
          (readItem as any)('payment_vouchers', query.payment_voucher_id),
        );
        filter.payment_voucher_id = { _eq: query.payment_voucher_id };
      }

      const result: any = await (client as any).request(
        (readItems as any)(this.collection, {
          filter,
          limit: pageSize,
          page,
          ...(query.sort && { sort: [query.sort] }),
          search: query.search,
        }),
      );

      const rawItems = Array.isArray(result) ? result : result.data || [];
      const items = await this.decorateActionByNames(rawItems);
      const total = result.meta?.filter_count ?? items.length;

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách nhật ký duyệt phiếu', error);
      rethrowHttpException(error);
      throwDirectusSdkError(
        error,
        'Không thể lấy danh sách nhật ký duyệt phiếu',
      );
    }
  }

  private async decorateActionByNames(items: any[]) {
    const userIds = Array.from(
      new Set(items.map((item) => item.action_by).filter(Boolean)),
    );
    if (userIds.length === 0) return items;

    try {
      const users: any[] = await (this.getAdminClient() as any).request(
        (readItems as any)('directus_users', {
          filter: { id: { _in: userIds } },
          fields: ['id', 'first_name', 'last_name', 'email'],
          limit: userIds.length,
        }),
      );
      const userMap = new Map(
        users.map((user) => {
          const fullName = [user.first_name, user.last_name]
            .filter(Boolean)
            .join(' ')
            .trim();
          return [user.id, fullName || user.email || user.id];
        }),
      );
      return items.map((item) => ({
        ...item,
        action_by_name: item.action_by
          ? userMap.get(item.action_by) || item.action_by
          : null,
      }));
    } catch (error) {
      this.logger.warn('Không thể decorate tên người duyệt cho approval logs');
      return items.map((item) => ({
        ...item,
        action_by_name: item.action_by,
      }));
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
        message: 'Lấy thông tin nhật ký duyệt phiếu thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(
        `Lỗi khi lấy thông tin nhật ký duyệt phiếu ${id}`,
        error,
      );
      throw new InternalServerErrorException(
        'Không thể lấy thông tin nhật ký duyệt phiếu',
      );
    }
  }

  async update(
    id: string,
    dto: UpdatePaymentVoucherApprovalLogsDto,
    userToken: string,
  ) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, dto),
      );
      return {
        message: 'Cập nhật nhật ký duyệt phiếu thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi cập nhật nhật ký duyệt phiếu ${id}`, error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async remove(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      await (client as any).request((deleteItem as any)(this.collection, id));
      return { message: 'Xóa nhật ký duyệt phiếu thành công' };
    } catch (error: any) {
      this.logger.error(`Lỗi khi xóa nhật ký duyệt phiếu ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể xóa nhật ký duyệt phiếu',
      );
    }
  }
}
