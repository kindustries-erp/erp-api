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
import {
  PortalFetchDto,
  PortalImportDto,
  PortalInvoiceDto,
} from './dto/portal-invoice.dto';
import { R2Service } from '../r2/r2.service';
import {
  parseVietnamInvoiceXml,
  XmlParseError,
} from './xml-parser/vietnam-invoice-xml.parser';
import AdmZip from 'adm-zip';

export interface ErpInvoiceQuery {
  direction?: string;
  search?: string;
  seller_name?: string;
  buyer_name?: string;
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
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 40;

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

    const where: any = { isDeleted: false };

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

    // Search / explicit seller/buyer name filters via QueryBuilder
    const needsQb = !!(query.search || query.seller_name || query.buyer_name);
    if (needsQb) {
      const qb = this.repository
        .createQueryBuilder('inv')
        .where('inv.is_deleted = false')
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
        });

      if (query.search) {
        qb.andWhere(
          `(inv.invoice_no ILIKE :q OR inv.serial_no ILIKE :q OR inv.buyer_name ILIKE :q OR inv.seller_name ILIKE :q OR inv.buyer_tax_code ILIKE :q OR inv.seller_tax_code ILIKE :q)`,
          { q: `%${query.search}%` },
        );
      }
      if (query.seller_name) {
        qb.andWhere('inv.seller_name ILIKE :sn', {
          sn: `%${query.seller_name}%`,
        });
      }
      if (query.buyer_name) {
        qb.andWhere('inv.buyer_name ILIKE :bn', {
          bn: `%${query.buyer_name}%`,
        });
      }

      const searchResults = await qb
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
    const data = await this.repository.findOne({
      where: { id, isDeleted: false },
      relations: ['items'],
    });
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
      items: dto.items?.map((i) => ({
        description: i.description,
        unit: i.unit,
        quantity: i.quantity != null ? String(i.quantity) : null,
        unitPrice: i.unitPrice != null ? String(i.unitPrice) : null,
        preVatAmount: String(i.preVatAmount ?? 0),
        vatRate: i.vatRate != null ? String(i.vatRate) : null,
        vatAmount: String(i.vatAmount ?? 0),
        discountAmount: String(i.discountAmount ?? 0),
        totalAmount: String(i.totalAmount ?? 0),
      })),
    } as any);
    const saved = (await this.repository.save(
      invoice,
    )) as unknown as ErpInvoice;
    return { message: 'Tạo thành công', data: this.toDto(saved) };
  }

  async update(id: string, dto: UpdateErpInvoiceDto) {
    const existing = await this.repository.findOne({
      where: { id, isDeleted: false },
      relations: ['items'],
    });
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

    // Merge entity first so that cascade update works
    this.repository.merge(existing, updatePayload);

    if (dto.items) {
      existing.items = dto.items.map((i) =>
        this.repository.manager.create('ErpInvoiceItem', {
          invoice: existing,
          invoiceId: id,
          description: i.description,
          unit: i.unit,
          quantity: i.quantity != null ? String(i.quantity) : null,
          unitPrice: i.unitPrice != null ? String(i.unitPrice) : null,
          preVatAmount: String(i.preVatAmount ?? 0),
          vatRate: i.vatRate != null ? String(i.vatRate) : null,
          vatAmount: String(i.vatAmount ?? 0),
          discountAmount: String(i.discountAmount ?? 0),
          totalAmount: String(i.totalAmount ?? 0),
        }),
      );
    }

    await this.repository.save(existing);
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException(`Invoice ${id} không tìm thấy`);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể xóa hóa đơn nháp');
    }

    await this.repository.update(id, { isDeleted: true } as any);

    if (existing.xmlFileKey) {
      try {
        await this.r2.deleteObject(existing.xmlFileKey);
      } catch (err) {
        this.logger.warn(
          `Failed to delete XML file from R2 for invoice ${id}: ${(err as Error).message}`,
        );
      }
    }

    return { message: 'Xóa thành công' };
  }

  async cancel(id: string) {
    const existing = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException(`Invoice ${id} không tìm thấy`);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Hóa đơn đã bị hủy');
    }
    if (existing.status === 'DRAFT') {
      throw new BadRequestException('Không thể hủy hóa đơn nháp, vui lòng xóa');
    }

    existing.status = 'CANCELLED';
    await this.repository.save(existing);

    return {
      message: 'Hủy thành công',
      data: { id },
    };
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
      items: invoice.items
        ? invoice.items.map((i) => ({
            ...i,
            quantity: i.quantity != null ? String(i.quantity) : null,
            unitPrice: i.unitPrice != null ? String(i.unitPrice) : null,
            preVatAmount: i.preVatAmount != null ? String(i.preVatAmount) : '0',
            vatRate: i.vatRate != null ? String(i.vatRate) : null,
            vatAmount: i.vatAmount != null ? String(i.vatAmount) : '0',
            discountAmount:
              i.discountAmount != null ? String(i.discountAmount) : '0',
            totalAmount: i.totalAmount != null ? String(i.totalAmount) : '0',
          }))
        : undefined,
    };
  }

  /**
   * POST /portal/sync
   * Lấy danh sách hóa đơn từ GDT portal, lưu vào DB (skip trùng),
   * sau đó download XML theo batch 10 với delay ngẫu nhiên 5-10s.
   */
  async syncFromPortal(dto: PortalFetchDto) {
    if (!dto.token) throw new BadRequestException('token is required');
    if (!dto.dateFrom || !dto.dateTo) {
      throw new BadRequestException('dateFrom and dateTo are required');
    }

    const type = dto.type ?? 'purchase';
    const direction: 'IN' | 'OUT' = type === 'purchase' ? 'IN' : 'OUT';

    // Build GDT URL – purchase uses /api/query, sold uses /api/sco-query
    const basePath =
      type === 'purchase'
        ? 'https://hoadondientu.gdt.gov.vn/api/query/invoices/purchase'
        : 'https://hoadondientu.gdt.gov.vn/api/sco-query/invoices/sold';

    const [fromY, fromM, fromD] = dto.dateFrom.split('-');
    const formattedDateFrom = `${fromD}/${fromM}/${fromY}`;
    const [toY, toM, toD] = dto.dateTo.split('-');
    const formattedDateTo = `${toD}/${toM}/${toY}`;

    const url = new URL(basePath);
    url.searchParams.set('sort', 'tdlap:desc');
    url.searchParams.set('size', '50');
    url.searchParams.set(
      'search',
      `tdlap=ge=${formattedDateFrom}T00:00:00;tdlap=le=${formattedDateTo}T23:59:59`,
    );

    const response = await this.fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${dto.token}` },
    });
    if (!response.ok)
      throw new BadRequestException(
        `Portal request failed with status ${response.status}`,
      );

    const payload = (await response.json()) as {
      datas?: any[];
      total?: number;
    };
    const rawItems: any[] = payload.datas ?? [];

    // ── Save new invoices to DB ───────────────────────────────────────────────
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const newlyCreatedIds: string[] = []; // track for XML download

    for (const raw of rawItems) {
      try {
        const invoiceNo = String(raw.shdon ?? '');
        const serialNo = raw.khhdon ?? null;

        const existing = await this.repository.findOne({
          where: { invoiceNo, serialNo, direction, isDeleted: false },
        });
        if (existing) {
          skipped++;
          continue;
        }

        const vatRate = this.resolvePortalVatRate(raw);
        const invoice = this.repository.create({
          invoiceNo,
          serialNo,
          invoiceDate: this.parsePortalIsoDate(raw.tdlap),
          direction,
          status: Number(raw.tthai) === 2 ? 'CANCELLED' : 'CONFIRMED',
          sellerTaxCode: raw.nbmst ?? null,
          sellerName: raw.nbten ?? null,
          sellerAddress: raw.nbdchi ?? null,
          buyerTaxCode: raw.nmmst ?? raw.mst ?? null,
          buyerName: raw.nmten ?? null,
          buyerAddress: raw.nmdchi ?? null,
          invoiceType: raw.thdon ?? null,
          preVatAmount: String(raw.tgtcthue ?? 0),
          vatRate,
          vatAmount: String(raw.tgtthue ?? 0),
          discountAmount: String(raw.ttcktmai ?? 0),
          totalAmount: String(raw.tgtttbso ?? 0),
          source: 'PORTAL',
          externalId: `${serialNo}_${invoiceNo}`,
        } as any);

        const saved = (await this.repository.save(
          invoice,
        )) as unknown as ErpInvoice;
        newlyCreatedIds.push(saved.id);
        created++;
      } catch (err) {
        errors.push((err as Error).message);
      }
    }

    // ── XML background download (fire & forget, rate-limited) ─────────────────
    if (newlyCreatedIds.length > 0) {
      this.downloadXmlsInBackground(newlyCreatedIds, dto.token).catch((e) =>
        this.logger.error('XML background download failed', e),
      );
    }

    return {
      total: rawItems.length,
      imported: created,
      skipped,
      direction,
      errors,
      xmlDownloadQueued: newlyCreatedIds.length,
    };
  }

  /**
   * Download XMLs cho danh sách hóa đơn theo batch 10, nghỉ random 5-10s giữa batch.
   * Chỉ download những hóa đơn chưa có xmlFileKey.
   */
  private async downloadXmlsInBackground(
    invoiceIds: string[],
    token: string,
  ): Promise<void> {
    const BATCH_SIZE = 10;
    const invoices = await this.repository.findByIds(invoiceIds);
    const targets = invoices.filter((inv) => !inv.xmlFileKey);

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map((inv) => this.downloadAndSaveXml(inv, token)),
      );

      // Random sleep 5-10s giữa batch (trừ batch cuối)
      if (i + BATCH_SIZE < targets.length) {
        const delay = (5 + Math.random() * 5) * 1000;
        await this.sleep(Math.round(delay));
      }
    }

    this.logger.log(`XML download complete: ${targets.length} files processed`);
  }

  private async downloadAndSaveXml(
    invoice: ErpInvoice,
    token: string,
  ): Promise<void> {
    try {
      const xmlUrl = new URL(
        'https://hoadondientu.gdt.gov.vn/api/query/invoices/export-xml',
      );
      xmlUrl.searchParams.set('nbmst', invoice.sellerTaxCode ?? '');
      xmlUrl.searchParams.set('khhdon', invoice.serialNo ?? '');
      xmlUrl.searchParams.set('shdon', invoice.invoiceNo);
      // khmshdon is not stored in entity; default to '1'
      xmlUrl.searchParams.set('khmshdon', '1');

      const res = await this.fetchWithRetry(xmlUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        this.logger.warn(
          `XML download failed for invoice ${invoice.invoiceNo}: HTTP ${res.status}`,
        );
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      const xmlBuffer = Buffer.from(arrayBuffer);

      const isZip =
        xmlBuffer.length > 4 && xmlBuffer[0] === 0x50 && xmlBuffer[1] === 0x4b;
      const ext = isZip ? 'zip' : 'xml';
      const contentType = isZip ? 'application/zip' : 'application/xml';

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');

      const dateStr = invoice.invoiceDate || `${yyyy}-${mm}-01`;
      const mst =
        invoice.direction === 'IN'
          ? invoice.sellerTaxCode
          : invoice.buyerTaxCode;
      const safeTax = (mst ?? 'unknown').replace(/[^\w]/g, '');
      const safeSerial = (invoice.serialNo ?? 'unknown').replace(
        /[^\w-]/g,
        '_',
      );
      const safeNo = invoice.invoiceNo.replace(/[^\w-]/g, '_');

      const fileName = `${dateStr}_${safeTax}_${safeSerial}_${safeNo}`;
      const xmlKey = `invoices/${invoice.direction}/${yyyy}/${mm}/${fileName}.${ext}`;

      await this.r2.uploadBuffer(xmlKey, xmlBuffer, contentType);
      await this.repository.update(invoice.id, { xmlFileKey: xmlKey } as any);
      this.logger.log(`XML saved for invoice ${invoice.invoiceNo}: ${xmlKey}`);

      // Lấy chi tiết hóa đơn từ API JSON
      await this.syncInvoiceDetailFromJson(invoice, token);
    } catch (err) {
      this.logger.warn(
        `downloadAndSaveXml error for ${invoice.invoiceNo}: ${(err as Error).message}`,
      );
    }
  }

  async reparseXml(id: string, token?: string): Promise<ErpInvoice> {
    const invoiceResp = await this.findOne(id);
    let invoice = invoiceResp.data;

    if (!invoice.xmlFileKey) {
      if (!token) {
        throw new BadRequestException(
          'Hóa đơn này chưa có file XML đính kèm và không có token portal để tự tải.',
        );
      }
      await this.downloadAndSaveXml(invoice as any, token);
      const updatedResp = await this.findOne(id);
      invoice = updatedResp.data;
      if (!invoice.xmlFileKey) {
        throw new BadRequestException(
          'Không thể tải XML từ GDT. Vui lòng kiểm tra lại token hoặc trạng thái hóa đơn.',
        );
      }
    }

    try {
      const xmlBuffer = await this.r2.downloadBuffer(invoice.xmlFileKey);

      let xmlString = '';
      const isZip =
        xmlBuffer.length > 4 && xmlBuffer[0] === 0x50 && xmlBuffer[1] === 0x4b;
      if (isZip) {
        const zip = new AdmZip(xmlBuffer);
        const zipEntries = zip.getEntries();
        const xmlEntry = zipEntries.find((e: any) =>
          e.entryName.toLowerCase().endsWith('.xml'),
        );
        if (xmlEntry) {
          xmlString = xmlEntry.getData().toString('utf8');
        }
      } else {
        xmlString = xmlBuffer.toString('utf8');
      }

      if (!xmlString) {
        throw new BadRequestException(
          'Không tìm thấy nội dung XML hợp lệ trong file đính kèm.',
        );
      }

      const parsedXml = parseVietnamInvoiceXml(xmlString);
      await this.update(invoice.id, {
        preVatAmount: parsedXml.preVatAmount,
        vatRate: parsedXml.vatRate ?? undefined,
        vatAmount: parsedXml.vatAmount,
        discountAmount: parsedXml.discountAmount,
        totalAmount: parsedXml.totalAmount,
        sellerName: parsedXml.sellerName ?? undefined,
        sellerAddress: parsedXml.sellerAddress ?? undefined,
        buyerName: parsedXml.buyerName ?? undefined,
        buyerAddress: parsedXml.buyerAddress ?? undefined,
        description: parsedXml.description ?? undefined,
        items: parsedXml.items.map((i) => ({
          ...i,
          unit: i.unit ?? undefined,
          quantity: i.quantity ?? undefined,
          unitPrice: i.unitPrice ?? undefined,
          vatRate: i.vatRate ?? undefined,
        })),
      });

      return (await this.findOne(id)).data as ErpInvoice;
    } catch (e) {
      this.logger.error(
        `Failed to reparse XML for ${id}: ${(e as Error).message}`,
      );
      throw new BadRequestException(
        `Không thể đồng bộ: ${(e as Error).message}`,
      );
    }
  }

  async syncDetailFromPortal(id: string, token: string): Promise<ErpInvoice> {
    const invoiceResp = await this.findOne(id);
    const invoice = invoiceResp.data as any;

    if (!token) {
      throw new BadRequestException(
        'Token portal là bắt buộc để đồng bộ từ GDT.',
      );
    }

    await this.syncInvoiceDetailFromJson(invoice, token);
    return (await this.findOne(id)).data as ErpInvoice;
  }

  private async syncInvoiceDetailFromJson(
    invoice: ErpInvoice,
    token: string,
  ): Promise<void> {
    try {
      const url = new URL(
        'https://hoadondientu.gdt.gov.vn/api/query/invoices/detail',
      );
      url.searchParams.set('nbmst', invoice.sellerTaxCode ?? '');
      url.searchParams.set('khhdon', invoice.serialNo ?? '');
      url.searchParams.set('shdon', invoice.invoiceNo);
      url.searchParams.set('khmshdon', '1');

      const res = await this.fetchWithRetry(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        this.logger.warn(
          `Failed to fetch JSON detail for ${invoice.invoiceNo}: HTTP ${res.status}`,
        );
        return;
      }

      const json = await res.json();

      const items = (json.hdhhdvu || []).map((i: any) => ({
        description: i.ten,
        unit: i.dvtinh,
        quantity: i.sluong != null ? Number(i.sluong) : undefined,
        unitPrice: i.dgia != null ? Number(i.dgia) : undefined,
        preVatAmount: i.thtien != null ? Number(i.thtien) : 0,
        vatRate:
          i.tsuat != null
            ? typeof i.tsuat === 'string'
              ? parseFloat(i.tsuat)
              : Number(i.tsuat)
            : undefined,
        vatAmount: i.tthue != null ? Number(i.tthue) : 0,
        discountAmount: i.stckhau != null ? Number(i.stckhau) : 0,
      }));

      await this.update(invoice.id, {
        preVatAmount: json.tgtcthue != null ? Number(json.tgtcthue) : undefined,
        vatAmount: json.tgtthue != null ? Number(json.tgtthue) : undefined,
        discountAmount:
          json.ttcktmai != null ? Number(json.ttcktmai) : undefined,
        totalAmount: json.tgtttbso != null ? Number(json.tgtttbso) : undefined,
        sellerName: json.nbten,
        sellerAddress: json.nbdchi,
        buyerName: json.nmten,
        buyerAddress: json.nmdchi,
        items,
      });

      this.logger.log(
        `Invoice details synced from JSON for ${invoice.invoiceNo}`,
      );
    } catch (err) {
      this.logger.warn(
        `syncInvoiceDetailFromJson error for ${invoice.invoiceNo}: ${(err as Error).message}`,
      );
    }
  }

  private async fetchWithRetry(
    url: string | URL,
    options?: RequestInit,
    retries = 3,
  ): Promise<Response> {
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          return res;
        }

        if (res.status >= 500 && res.status <= 599) {
          if (i < retries) {
            this.logger.warn(
              `GDT API 50x error (${res.status}) on ${url}, retrying ${i + 1}/${retries}...`,
            );
            await this.sleep(1000 * (i + 1));
            continue;
          }
        }

        return res;
      } catch (err: any) {
        if (i < retries) {
          this.logger.warn(
            `GDT API fetch failed (${err.name}: ${err.message}) on ${url}, retrying ${i + 1}/${retries}...`,
          );
          await this.sleep(1000 * (i + 1));
          continue;
        }
        throw err;
      }
    }
    throw new Error('Unreachable code');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private resolvePortalVatRate(raw: any): string | null {
    // Ưu tiên thttltsuat[0].tsuat ("8%" -> 0.08)
    if (Array.isArray(raw.thttltsuat) && raw.thttltsuat.length > 0) {
      const rateStr = String(raw.thttltsuat[0]?.tsuat ?? '');
      const match = rateStr.match(/([\d.]+)/);
      if (match) return String(Number(match[1]) / 100);
    }
    if (raw.tsuattue != null) {
      const n = Number(raw.tsuattue);
      return Number.isFinite(n) ? String(n / 100) : null;
    }
    return null;
  }

  private parsePortalIsoDate(isoDate: string): string {
    // GDT trả về ISO: "2026-04-29T17:00:00Z"
    return isoDate ? isoDate.slice(0, 10) : '';
  }

  private normalizePortalVatRate(rate: number | string) {
    const n = Number(rate);
    return Number.isFinite(n) ? String(n / 100) : null;
  }

  private parsePortalDate(date: string) {
    const [dd, mm, yyyy] = date.split('/');
    return `${yyyy}-${mm}-${dd}`;
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

        const dateStr = parsed.invoiceDate || `${yyyy}-${mm}-01`;
        const mst =
          direction === 'IN' ? parsed.sellerTaxCode : parsed.buyerTaxCode;
        const safeTax = (mst ?? 'unknown').replace(/[^\w]/g, '');
        const safeSerial = (parsed.serialNo ?? 'unknown').replace(
          /[^\w-]/g,
          '_',
        );
        const safeNo = parsed.invoiceNo.replace(/[^\w-]/g, '_');

        const fileName = `${dateStr}_${safeTax}_${safeSerial}_${safeNo}`;
        const xmlKey = `invoices/${direction}/${yyyy}/${mm}/${fileName}.xml`;

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
          status: 'CONFIRMED',
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

    const ext = key.split('.').pop() || fileType;
    const dateStr = invoice.invoiceDate || 'unknown';
    const mst =
      invoice.direction === 'IN' ? invoice.sellerTaxCode : invoice.buyerTaxCode;
    const safeTax = (mst ?? 'unknown').replace(/[^\w]/g, '');
    const safeSerial = (invoice.serialNo ?? 'unknown').replace(/[^\w-]/g, '_');
    const safeNo = invoice.invoiceNo.replace(/[^\w-]/g, '_');

    const filename = `${dateStr}_${safeTax}_${safeSerial}_${safeNo}.${ext}`;

    const url = await this.r2.getPresignedDownloadUrl(key, 3600, filename);
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
