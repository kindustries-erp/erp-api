import { Injectable, NotFoundException } from '@nestjs/common';
import { ErpBusinessPartner } from './entities/erp_business_partner.entity';
import { CreateErpBusinessPartnerDto } from './dto/create-erp-business-partner.dto';
import { QueryErpBusinessPartnerDto } from './dto/query-erp-business-partner.dto';
import { UpdateErpBusinessPartnerDto } from './dto/update-erp-business-partner.dto';
import { toErpBusinessPartnerResponse } from './helpers/erp-business-partner.mapper';
import {
  nextPartnerCode,
  normalizePartnerCode,
} from './helpers/erp-business-partner-code.helper';
import { ErpBusinessPartnerCommandService } from './services/erp-business-partner-command.service';
import { ErpBusinessPartnerQueryService } from './services/erp-business-partner-query.service';
import { ErpBusinessPartnerInvoiceSyncService } from './services/erp-business-partner-invoice-sync.service';
import { ErpBusinessPartnerOptionsService } from './services/erp-business-partner-options.service';
import { QueryErpBusinessPartnerOptionsDto } from './dto/query-erp-business-partner-options.dto';
import { normalizeTaxCode } from '@/common/utils/invoice-partner-key.util';

/** Facade của module: điều phối query/command, sinh mã và luôn trả response DTO, không lộ entity. */
@Injectable()
export class BusinessPartnersCoreService {
  constructor(
    private readonly query: ErpBusinessPartnerQueryService,
    private readonly command: ErpBusinessPartnerCommandService,
    private readonly invoiceSync: ErpBusinessPartnerInvoiceSyncService,
    private readonly options: ErpBusinessPartnerOptionsService,
  ) {}

  /** Tìm hoặc tạo đối tác từ người mua/bán hóa đơn, trả về id (dùng khi gán Đối tượng sao kê). */
  ensurePartnerForInvoiceKey(ref: {
    taxCode: string | null;
    name: string;
    partnerType: 'CUSTOMER' | 'VENDOR';
  }): Promise<string> {
    return this.invoiceSync.ensureFromInvoiceKey(ref);
  }

  /** Danh sách chọn Đối tượng cho sao kê (danh mục + người mua/bán từ hóa đơn). */
  listOptions(dto: QueryErpBusinessPartnerOptionsDto) {
    return this.options.listOptions(dto);
  }

  /** Đồng bộ đối tác từ hóa đơn. dryRun chỉ trả danh sách sẽ tạo. */
  async syncFromInvoices(dryRun = false) {
    if (dryRun) {
      const items = await this.invoiceSync.findMissingCandidates();
      return {
        message: 'Xem trước đồng bộ',
        dryRun: true,
        count: items.length,
        items,
      };
    }
    const result = await this.invoiceSync.run();
    return {
      message: 'Đồng bộ thành công',
      dryRun: false,
      count: result.created,
      items: result.items,
    };
  }

  async findAll(dto: QueryErpBusinessPartnerDto) {
    const page = await this.query.findAll(dto);
    return {
      items: page.items.map((item) => toErpBusinessPartnerResponse(item)),
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
    partnerType?: string,
  ) {
    return this.query.findColumnOptions(
      column,
      search,
      page,
      pageSize,
      filters,
      partnerType,
    );
  }

  /** Mã kế tiếp theo loại đối tác, dùng để điền sẵn khi tạo mới. */
  async getNextCode(partnerType?: string): Promise<{ nextCode: string }> {
    return { nextCode: await this.generateCode(partnerType) };
  }

  async findOne(id: string) {
    const entity = await this.requireById(id);
    return {
      message: 'Lấy thông tin thành công',
      data: toErpBusinessPartnerResponse(entity),
    };
  }

  async create(dto: CreateErpBusinessPartnerDto) {
    // Không nhập mã thì tự sinh theo loại; nhập thì chuẩn hóa và kiểm tra trùng
    const code = dto.code?.trim()
      ? normalizePartnerCode(dto.code)
      : await this.generateCode(dto.partnerType);
    await this.command.assertCodeAvailable(code);
    const taxCode = normalizeTaxCode(dto.taxCode);
    if (taxCode) await this.command.assertTaxCodeAvailable(taxCode);

    const entity = await this.command.create({
      ...dto,
      code,
      taxCode: taxCode ?? undefined,
    });
    return {
      message: 'Tạo thành công',
      data: toErpBusinessPartnerResponse(entity),
    };
  }

  async update(id: string, dto: UpdateErpBusinessPartnerDto) {
    const entity = await this.requireById(id);

    // Mã rỗng hoặc bỏ trống thì giữ mã cũ
    const code = dto.code?.trim() ? normalizePartnerCode(dto.code) : undefined;
    if (code) await this.command.assertCodeAvailable(code, id);
    const taxCode = normalizeTaxCode(dto.taxCode);
    if (taxCode) await this.command.assertTaxCodeAvailable(taxCode, id);

    const saved = await this.command.update(entity, {
      ...dto,
      code,
      taxCode: taxCode ?? undefined,
    });
    return {
      message: 'Cập nhật thành công',
      data: toErpBusinessPartnerResponse(saved),
    };
  }

  async remove(id: string) {
    const entity = await this.requireById(id);
    const saved = await this.command.softDelete(entity);
    return {
      message: 'Xóa thành công',
      data: toErpBusinessPartnerResponse(saved),
    };
  }

  private async generateCode(partnerType?: string): Promise<string> {
    const codes = await this.query.findCodesForNextCode(partnerType);
    return nextPartnerCode(codes, partnerType);
  }

  private async requireById(id: string): Promise<ErpBusinessPartner> {
    const entity = await this.query.findById(id);
    if (!entity) {
      throw new NotFoundException(
        `Không tìm thấy ErpBusinessPartner với id ${id}`,
      );
    }
    return entity;
  }
}
