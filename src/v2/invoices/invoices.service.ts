import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Invoice } from './entities/invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { toInvoiceResponse } from './helpers/invoice.mapper';
import { INVOICE_MESSAGES } from './invoice-messages';
import { InvoiceCommandService } from './services/invoice-command.service';
import { InvoiceQueryService } from './services/invoice-query.service';
import { R2Service } from '@/r2/r2.service';

/** Facade của module: điều phối query/command và luôn trả response DTO, không lộ entity. */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly query: InvoiceQueryService,
    private readonly command: InvoiceCommandService,
    private readonly r2: R2Service,
  ) {}

  async findAll(dto: QueryInvoiceDto) {
    const page = await this.query.findAll(dto);
    return {
      items: page.items.map((item) => toInvoiceResponse(item)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: Math.ceil(page.total / page.pageSize),
      summaries: page.summaries,
    };
  }

  findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters?: string,
  ) {
    return this.query.findColumnOptions(
      column,
      search,
      page,
      pageSize,
      filters,
    );
  }

  async findOne(id: string) {
    const entity = await this.requireById(id);
    return {
      message: INVOICE_MESSAGES.FETCHED,
      data: toInvoiceResponse(entity),
    };
  }

  async create(dto: CreateInvoiceDto) {
    const entity = await this.command.create(dto);
    return {
      message: INVOICE_MESSAGES.CREATED,
      data: toInvoiceResponse(entity),
    };
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    const entity = await this.requireById(id);
    const saved = await this.command.update(entity, dto);
    return {
      message: INVOICE_MESSAGES.UPDATED,
      data: toInvoiceResponse(saved),
    };
  }

  /** Chỉ xóa hóa đơn nháp (quy tắc v1). Sau khi xóa mềm, dọn file XML trên R2; lỗi R2 chỉ ghi log. */
  async remove(id: string) {
    const entity = await this.requireById(id);
    if (entity.status !== 'DRAFT') {
      throw new BadRequestException(INVOICE_MESSAGES.DELETE_NOT_DRAFT);
    }
    const saved = await this.command.softDelete(entity);
    if (saved.xmlFileKey) {
      try {
        await this.r2.deleteObject(saved.xmlFileKey);
      } catch (err) {
        this.logger.warn(
          `Failed to delete XML file from R2 for invoice ${id}: ${(err as Error).message}`,
        );
      }
    }
    return {
      message: INVOICE_MESSAGES.DELETED,
      data: toInvoiceResponse(saved),
    };
  }

  private async requireById(id: string): Promise<Invoice> {
    const entity = await this.query.findById(id);
    if (!entity) {
      throw new NotFoundException(INVOICE_MESSAGES.NOT_FOUND);
    }
    return entity;
  }
}
