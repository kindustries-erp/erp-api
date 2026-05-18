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
import { CreatePaymentVoucherAttachmentsDto } from './dto/create-payment-voucher-attachments.dto';
import { UpdatePaymentVoucherAttachmentsDto } from './dto/update-payment-voucher-attachments.dto';
import { GetPaymentVoucherAttachmentsDto } from './dto/get-payment-voucher-attachments.dto';

@Injectable()
export class PaymentVoucherAttachmentsService {
  private readonly logger = new Logger(PaymentVoucherAttachmentsService.name);
  private readonly collection = 'payment_voucher_attachments';

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

  async create(dto: CreatePaymentVoucherAttachmentsDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (createItem as any)(this.collection, { ...dto }),
      );
      return { message: 'Tạo đính kèm phiếu thu chi thành công', data: result };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo đính kèm phiếu thu chi', error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async findAll(query: GetPaymentVoucherAttachmentsDto, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const sort = query.sort || '-uploaded_at';

      const filter: any = {};
      if (query.payment_voucher_id) {
        filter.payment_voucher_id = { _eq: query.payment_voucher_id };
      }
      if (query.search) {
        filter._or = [
          { note: { _contains: query.search } },
          { attachment_type: { _contains: query.search } },
        ];
      }

      const result: any = await (client as any).request(
        (readItems as any)(this.collection, {
          filter,
          limit: pageSize,
          page: page,
          sort: sort ? [sort] : ['-uploaded_at'],
          fields: [
            'id',
            'payment_voucher_id',
            'attachment_type',
            'note',
            'uploaded_at',
            {
              file: ['id', 'filename_download', 'title', 'type'],
            },
          ],
        }),
      );

      // SDK có thể trả về mảng trực tiếp hoặc object { data, meta } tùy vào cấu hình/phiên bản
      const items = Array.isArray(result) ? result : result.data || [];
      const total = result.meta?.filter_count ?? items.length;

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách đính kèm phiếu thu chi', error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách đính kèm phiếu thu chi',
      );
    }
  }

  async findOne(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (readItem as any)(this.collection, id, {
          fields: [
            'id',
            'payment_voucher_id',
            'attachment_type',
            'note',
            'uploaded_at',
            {
              file: ['id', 'filename_download', 'title', 'type'],
            },
          ],
        }),
      );
      return {
        message: 'Lấy thông tin đính kèm phiếu thu chi thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(
        `Lỗi khi lấy thông tin đính kèm phiếu thu chi ${id}`,
        error,
      );
      throw new InternalServerErrorException(
        'Không thể lấy thông tin đính kèm phiếu thu chi',
      );
    }
  }

  async update(
    id: string,
    dto: UpdatePaymentVoucherAttachmentsDto,
    userToken: string,
  ) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, dto),
      );
      return {
        message: 'Cập nhật đính kèm phiếu thu chi thành công',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi cập nhật đính kèm phiếu thu chi ${id}`, error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async remove(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      await (client as any).request((updateItem as any)(this.collection, id, { is_active: false }));
      return { message: 'Xóa đính kèm phiếu thu chi thành công' };
    } catch (error: any) {
      this.logger.error(`Lỗi khi xóa đính kèm phiếu thu chi ${id}`, error);
      throw new InternalServerErrorException(
        'Không thể xóa đính kèm phiếu thu chi',
      );
    }
  }
}
