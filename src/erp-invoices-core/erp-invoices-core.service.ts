import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { ErpInvoice } from './entities/erp_invoice.entity';
import { CreateErpInvoiceDto } from './dto/create-erp-invoice.dto';
import { UpdateErpInvoiceDto } from './dto/update-erp-invoice.dto';
import { R2Service } from './r2/r2.service';
import {
  parseVietnamInvoiceXml,
  XmlParseError,
} from './xml-parser/vietnam-invoice-xml.parser';

export interface ErpInvoiceQuery {
  direction?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

@Injectable()
export class ErpInvoicesCoreService {
  private readonly logger = new Logger(ErpInvoicesCoreService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    private readonly r2: R2Service,
  ) {}

  async findAll(query: ErpInvoiceQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 40;

    let orderColumn = 'inv.invoice_date';
    let orderProperty = 'invoiceDate';
    let orderDirection: 'ASC' | 'DESC' = 'DESC';

    if (query.sort_by) {
      if (query.sort_by === 'invoiceNo') {
        orderColumn = 'inv.invoice_no';
        orderProperty = 'invoiceNo';
      } else if (query.sort_by === 'totalAmount') {
        orderColumn = 'inv.total_amount';
        orderProperty = 'totalAmount';
      } else if (query.sort_by === 'sellerName') {
        orderColumn = 'inv.seller_name';
        orderProperty = 'sellerName';
      } else if (query.sort_by === 'buyerName') {
        orderColumn = 'inv.buyer_name';
        orderProperty = 'buyerName';
      } else if (query.sort_by === 'status') {
        orderColumn = 'inv.status';
        orderProperty = 'status';
      }
    }
    if (query.sort_order) {
      orderDirection = query.sort_order.toUpperCase() as 'ASC' | 'DESC';
    }

    const where: any = {};

    if (query.direction) {
      where.direction = query.direction;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.date_from && query.date_to) {
      where.invoiceDate = Between(query.date_from, query.date_to);
    } else if (query.date_from) {
      where.invoiceDate = MoreThanOrEqual(query.date_from);
    } else if (query.date_to) {
      where.invoiceDate = LessThanOrEqual(query.date_to);
    }

    // Search theo invoice_no, buyer_name, seller_name
    if (query.search) {
      const searchResults = await this.repository
        .createQueryBuilder('inv')
        .where(
          `inv.invoice_no ILIKE :q OR inv.serial_no ILIKE :q OR inv.buyer_name ILIKE :q OR inv.seller_name ILIKE :q OR inv.buyer_tax_code ILIKE :q OR inv.seller_tax_code ILIKE :q`,
          { q: `%${query.search}%` },
        )
        .andWhere(query.direction ? 'inv.direction = :dir' : '1=1', {
          dir: query.direction,
        })
        .andWhere(query.status ? 'inv.status = :status' : '1=1', {
          status: query.status,
        })
        .andWhere(query.date_from ? 'inv.invoice_date >= :dateFrom' : '1=1', {
          dateFrom: query.date_from,
        })
        .andWhere(query.date_to ? 'inv.invoice_date <= :dateTo' : '1=1', {
          dateTo: query.date_to,
        })
        .orderBy(orderColumn, orderDirection)
        .addOrderBy('inv.created_at', 'DESC')
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();

      return {
        items: searchResults[0].map((i) => this.toDto(i)),
        total: searchResults[1],
        page,
        pageSize,
        totalPages: Math.ceil(searchResults[1] / pageSize),
      };
    }

    const [items, total] = await this.repository.findAndCount({
      where,
      order: { [orderProperty]: orderDirection, createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((i) => this.toDto(i)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const data = await this.repository.findOne({ where: { id } });
    if (!data) throw new NotFoundException(`Invoice ${id} không tìm thấy`);
    return { message: 'Lấy thông tin thành công', data: this.toDto(data) };
  }

  async create(dto: CreateErpInvoiceDto) {
    const invoice = this.repository.create({
      ...dto,
      preVatAmount: String(dto.preVatAmount ?? 0),
      vatRate: dto.vatRate != null ? String(dto.vatRate) : null,
      vatAmount: String(dto.vatAmount ?? 0),
      discountAmount: String(dto.discountAmount ?? 0),
      totalAmount: String(dto.totalAmount ?? 0),
    } as any);
    const saved = (await this.repository.save(
      invoice,
    )) as unknown as ErpInvoice;
    return { message: 'Tạo thành công', data: this.toDto(saved) };
  }

  async update(id: string, dto: UpdateErpInvoiceDto) {
    const existing = await this.repository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Invoice ${id} không tìm thấy`);

    const updatePayload: any = { ...dto };
    if (dto.preVatAmount != null)
      updatePayload.preVatAmount = String(dto.preVatAmount);
    if (dto.vatRate != null) updatePayload.vatRate = String(dto.vatRate);
    if (dto.vatAmount != null) updatePayload.vatAmount = String(dto.vatAmount);
    if (dto.discountAmount != null)
      updatePayload.discountAmount = String(dto.discountAmount);
    if (dto.totalAmount != null)
      updatePayload.totalAmount = String(dto.totalAmount);

    await this.repository.update(id, updatePayload);
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.repository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Invoice ${id} không tìm thấy`);
    await this.repository.delete(id);
    return { message: 'Xóa thành công' };
  }

  private toDto(invoice: ErpInvoice) {
    return {
      ...invoice,
      preVatAmount:
        invoice.preVatAmount != null ? String(invoice.preVatAmount) : '0',
      vatRate: invoice.vatRate != null ? String(invoice.vatRate) : null,
      vatAmount: invoice.vatAmount != null ? String(invoice.vatAmount) : '0',
      discountAmount:
        invoice.discountAmount != null ? String(invoice.discountAmount) : '0',
      totalAmount:
        invoice.totalAmount != null ? String(invoice.totalAmount) : '0',
    };
  }

  // ---------------------------------------------------------------------------
  // Bulk XML import
  // ---------------------------------------------------------------------------

  async bulkImportBuyerXml(
    files: Array<{ filename: string; buffer: Buffer }>,
  ): Promise<BulkImportResult> {
    return this._doBulkImport(files, 'IN');
  }

  async bulkImportSellerXml(
    files: Array<{ filename: string; buffer: Buffer }>,
  ): Promise<BulkImportResult> {
    return this._doBulkImport(files, 'OUT');
  }

  private async _doBulkImport(
    files: Array<{ filename: string; buffer: Buffer }>,
    direction: 'IN' | 'OUT',
  ): Promise<BulkImportResult> {
    const importId = crypto.randomUUID();
    const skipped: BulkImportSkippedItem[] = [];
    const errors: BulkImportErrorItem[] = [];
    let created = 0;

    for (const file of files) {
      try {
        // 1. Parse XML
        const parsed = parseVietnamInvoiceXml(file.buffer.toString('utf-8'));

        // 2. Kiểm tra duplicate: invoice_no + seller_tax_code
        const existing = await this.repository.findOne({
          where: {
            invoiceNo: parsed.invoiceNo,
            sellerTaxCode: parsed.sellerTaxCode ?? undefined,
          },
        });

        if (existing) {
          skipped.push({
            filename: file.filename,
            invoiceNo: parsed.invoiceNo,
            sellerName: parsed.sellerName,
            sellerTaxCode: parsed.sellerTaxCode,
            reason: 'DUPLICATE',
          });
          continue;
        }

        // 3. Upload XML lên R2
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const safeTax = (parsed.sellerTaxCode ?? 'unknown').replace(
          /[^\w]/g,
          '',
        );
        const safeNo = parsed.invoiceNo.replace(/[^\w-]/g, '_');
        const xmlKey = `invoices/${direction}/${yyyy}/${mm}/${safeNo}_${safeTax}.xml`;

        try {
          await this.r2.uploadBuffer(xmlKey, file.buffer, 'application/xml');
        } catch (r2Err) {
          this.logger.warn(
            `R2 upload failed for ${file.filename}: ${(r2Err as Error).message}`,
          );
          // R2 lỗi không block tạo invoice — xmlFileKey sẽ null
        }

        // 4. Tạo record erp_invoice
        const invoice = this.repository.create({
          invoiceNo: parsed.invoiceNo,
          serialNo: parsed.serialNo,
          invoiceDate: parsed.invoiceDate,
          direction,
          status: 'DRAFT',
          sellerName: parsed.sellerName,
          sellerTaxCode: parsed.sellerTaxCode,
          sellerAddress: parsed.sellerAddress,
          sellerBank: parsed.sellerBank,
          buyerName: parsed.buyerName,
          buyerTaxCode: parsed.buyerTaxCode,
          buyerAddress: parsed.buyerAddress,
          description: parsed.description,
          preVatAmount: String(parsed.preVatAmount),
          vatRate: parsed.vatRate != null ? String(parsed.vatRate) : null,
          vatAmount: String(parsed.vatAmount),
          discountAmount: String(parsed.discountAmount),
          totalAmount: String(parsed.totalAmount),
          xmlFileKey: xmlKey,
          xmlImportId: importId,
        } as any);

        await this.repository.save(invoice);
        created++;
      } catch (err) {
        const reason =
          err instanceof XmlParseError
            ? err.message
            : `Lỗi hệ thống: ${(err as Error).message}`;
        errors.push({ filename: file.filename, reason });
      }
    }

    return {
      importId,
      direction,
      total: files.length,
      created,
      skipped,
      errors,
    };
  }

  // ---------------------------------------------------------------------------
  // Pre-signed URLs
  // ---------------------------------------------------------------------------

  async getFileDownloadUrl(
    invoiceId: string,
    fileType: 'pdf' | 'xml',
  ): Promise<{ url: string; expiresAt: string }> {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const key = fileType === 'pdf' ? invoice.pdfFileKey : invoice.xmlFileKey;
    if (!key)
      throw new BadRequestException(
        `Invoice chưa có file ${fileType.toUpperCase()} trên R2`,
      );

    const url = await this.r2.getPresignedDownloadUrl(key, 3600);
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    return { url, expiresAt };
  }

  async getFileUploadUrl(
    invoiceId: string,
    fileType: 'pdf' | 'xml',
  ): Promise<{ url: string; key: string; expiresAt: string }> {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const safeNo = invoice.invoiceNo.replace(/[^\w-]/g, '_');
    const key = `invoices/${invoice.direction}/${yyyy}/${mm}/${safeNo}.${fileType}`;
    const contentType =
      fileType === 'pdf' ? 'application/pdf' : 'application/xml';

    const url = await this.r2.getPresignedUploadUrl(key, contentType, 900);
    const expiresAt = new Date(Date.now() + 900 * 1000).toISOString();

    // Ghi key vào DB
    if (fileType === 'pdf') {
      await this.repository.update(invoiceId, { pdfFileKey: key } as any);
    } else {
      await this.repository.update(invoiceId, { xmlFileKey: key } as any);
    }

    return { url, key, expiresAt };
  }
}

// ---------------------------------------------------------------------------
// Result interfaces
// ---------------------------------------------------------------------------

export interface BulkImportSkippedItem {
  filename: string;
  invoiceNo: string;
  sellerName: string | null;
  sellerTaxCode: string | null;
  reason: 'DUPLICATE';
}

export interface BulkImportErrorItem {
  filename: string;
  reason: string;
}

export interface BulkImportResult {
  importId: string;
  direction: 'IN' | 'OUT';
  total: number;
  created: number;
  skipped: BulkImportSkippedItem[];
  errors: BulkImportErrorItem[];
}
