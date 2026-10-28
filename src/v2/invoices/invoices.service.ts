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
import { resolveBranchIds } from './helpers/invoice-branch.helper';
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
    const items = await this.query.findItems(id);
    return {
      message: INVOICE_MESSAGES.FETCHED,
      data: toInvoiceResponse(entity, items),
    };
  }

  async create(dto: CreateInvoiceDto, userId?: string) {
    await this.assertBranchesExist(resolveBranchIds(dto));
    const entity = await this.command.create(dto, userId ?? null);
    return {
      message: INVOICE_MESSAGES.CREATED,
      data: toInvoiceResponse(entity),
    };
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    const entity = await this.requireById(id);
    await this.assertBranchesExist(resolveBranchIds(dto));
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

  async bulkSetBranch(ids: string[], branchIds: string[]) {
    const unique = [...new Set(branchIds)];
    await this.assertBranchesExist(unique);
    const result = await this.command.bulkSetBranch(ids, unique);
    return { message: INVOICE_MESSAGES.BULK_UPDATED, data: result };
  }

  async bulkSetNotes(ids: string[], notes: string | null) {
    const result = await this.command.bulkSetNotes(ids, notes);
    return { message: INVOICE_MESSAGES.BULK_UPDATED, data: result };
  }

  private async requireById(id: string): Promise<Invoice> {
    const entity = await this.query.findById(id);
    if (!entity) {
      throw new NotFoundException(INVOICE_MESSAGES.NOT_FOUND);
    }
    return entity;
  }

  /** Mọi chi nhánh được gán phải còn hoạt động, nếu không thì từ chối. */
  private async assertBranchesExist(
    branchIds: string[] | undefined,
  ): Promise<void> {
    if (!branchIds?.length) return;
    const found = await this.query.findExistingBranchIds(branchIds);
    if (found.length !== new Set(branchIds).size) {
      throw new BadRequestException(INVOICE_MESSAGES.BRANCH_NOT_FOUND);
    }
  }
}
