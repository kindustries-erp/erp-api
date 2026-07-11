import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
  IsNull,
  In,
} from 'typeorm';
import { ErpInvoice } from './entities/erp_invoice.entity';
import { ErpInvoiceItem } from './entities/erp_invoice_item.entity';
import { ErpInvoiceVoucherNetOff } from './entities/erp_invoice_voucher_netoff.entity';
import { CompanyProfile } from '../company-profile/entities/company-profile.entity';
import { CreateErpInvoiceDto } from './dto/create-erp-invoice.dto';
import { UpdateErpInvoiceDto } from './dto/update-erp-invoice.dto';
import {
  PortalFetchDto,
  PortalImportDto,
  PortalInvoiceDto,
} from './dto/portal-invoice.dto';
import { Subject } from 'rxjs';
import { R2Service } from '../r2/r2.service';
import {
  parseVietnamInvoiceXml,
  XmlParseError,
} from './xml-parser/vietnam-invoice-xml.parser';
import AdmZip from 'adm-zip';
import * as ExcelJS from 'exceljs';
import { BankTransactionsCoreService } from '../bank-transactions-core/bank-transactions-core.service';

export interface ErpInvoiceQuery {
  direction?: string;
  search?: string;
  seller_name?: string;
  buyer_name?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  tag_id?: string;
  page?: number;
  pageSize?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  export_type?: 'summary' | 'detailed';
}

@Injectable()
export class ErpInvoicesCoreService {
  private readonly logger = new Logger(ErpInvoicesCoreService.name);
  public readonly progress$ = new Subject<{
    processId: string;
    type: string;
    total: number;
    current: number;
    message: string;
    completed: boolean;
  }>();

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    @InjectRepository(CompanyProfile)
    private readonly companyProfileRepo: Repository<CompanyProfile>,
    private readonly r2: R2Service,
    private readonly bankTransactionsCoreService: BankTransactionsCoreService,
  ) {}

  private async loadNetOffAmounts(invoices: ErpInvoice[]) {
    if (invoices.length === 0) return invoices;
    const ids = invoices.map((i) => i.id);
    const netOffs = await this.repository.manager
      .createQueryBuilder('erp_invoice_voucher_netoff', 'netoff')
      .select('netoff.invoice_id', 'invoiceId')
      .addSelect('SUM(netoff.net_off_amount)', 'sum')
      .where('netoff.invoice_id IN (:...ids)', { ids })
      .groupBy('netoff.invoice_id')
      .getRawMany();

    const netOffMap = netOffs.reduce(
      (acc, curr) => {
        acc[curr.invoiceId] = Number(curr.sum) || 0;
        return acc;
      },
      {} as Record<string, number>,
    );

    return invoices.map((i) => ({
      ...i,
      netOffAmount: String(netOffMap[i.id] || 0),
    }));
  }

  async getPortalToken(): Promise<string> {
    const profile = await this.companyProfileRepo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });
    return profile?.gdt_portal_token || '';
  }

  async savePortalToken(token: string): Promise<void> {
    let profile = await this.companyProfileRepo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });
    if (!profile) {
      profile = this.companyProfileRepo.create({
        company_name: 'Your Company Name',
        gdt_portal_token: token,
      });
    } else {
      profile.gdt_portal_token = token;
    }
    await this.companyProfileRepo.save(profile);
  }

  private extractInvoiceMetadata(invoice: any): void {
    const fullDesc = [
      invoice.description,
      invoice.notes,
      ...(invoice.items || []).map((i: any) => i.description),
    ]
      .filter(Boolean)
      .join(' | ');

    // Extract Lệnh quyết toán (-WO- or GR-)
    const woMatch = fullDesc.match(/(\S*-WO-\S*|GR-\S*)/i);
    if (woMatch) {
      let wo = woMatch[0];
      if (wo.toUpperCase().startsWith('QT')) {
        wo = wo.substring(2);
      }
      invoice.settlementOrder = wo;
    }

    // Extract Biển số xe (e.g. 50E82434, 50H-38666, 89A-482.19, etc.)
    const plateMatch = fullDesc.match(/\d{2}[A-ZĐ][A-Z0-9]?[-.\s]?\d{4,5}/i);
    if (plateMatch) {
      invoice.licensePlate = plateMatch[0];
    }
  }

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
    let effectiveDateTo = query.date_to;
    if (effectiveDateTo && effectiveDateTo.length === 10) {
      effectiveDateTo = `${effectiveDateTo} 23:59:59.999`;
    }

    if (query.date_from && effectiveDateTo) {
      where.invoiceDate = Between(query.date_from, effectiveDateTo);
    } else if (query.date_from) {
      where.invoiceDate = MoreThanOrEqual(query.date_from);
    } else if (effectiveDateTo) {
      where.invoiceDate = LessThanOrEqual(effectiveDateTo);
    }

    // Search / explicit seller/buyer name filters via QueryBuilder
    const needsQb = !!(
      query.search ||
      query.seller_name ||
      query.buyer_name ||
      query.tag_id ||
      query.sort_by === 'invoiceNo'
    );
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
          dateTo:
            query.date_to?.length === 10
              ? `${query.date_to} 23:59:59.999`
              : query.date_to,
        });

      if (query.search) {
        const qClean = `%${query.search.replace(/[,.]/g, '')}%`;
        qb.andWhere(
          `(
            inv.invoice_no ILIKE :q 
            OR inv.serial_no ILIKE :q 
            OR inv.buyer_name ILIKE :q 
            OR inv.seller_name ILIKE :q 
            OR inv.buyer_tax_code ILIKE :q 
            OR inv.seller_tax_code ILIKE :q
            OR inv.description ILIKE :q
            OR REPLACE(REPLACE(CAST(inv.pre_vat_amount AS TEXT), '.', ''), ',', '') ILIKE :qClean
            OR REPLACE(REPLACE(CAST(inv.vat_rate AS TEXT), '.', ''), ',', '') ILIKE :qClean
            OR REPLACE(REPLACE(CAST(inv.vat_amount AS TEXT), '.', ''), ',', '') ILIKE :qClean
            OR REPLACE(REPLACE(CAST(inv.discount_amount AS TEXT), '.', ''), ',', '') ILIKE :qClean
            OR REPLACE(REPLACE(CAST(inv.total_amount AS TEXT), '.', ''), ',', '') ILIKE :qClean
          )`,
          { q: `%${query.search}%`, qClean },
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
      if (query.tag_id) {
        qb.andWhere(
          `inv.id IN (SELECT entity_id FROM sys_entity_tags WHERE entity_type = 'erp_invoice' AND tag_id = :tagId)`,
          { tagId: query.tag_id },
        );
      }

      let qbOrderColumn = orderColumn;
      if (query.sort_by === 'invoiceNo') {
        qbOrderColumn =
          "NULLIF(regexp_replace(inv.invoice_no, '\\\\D', '', 'g'), '')::numeric";
      }

      let qbOrdered = qb.orderBy(qbOrderColumn, orderDirection);
      if (query.sort_by === 'invoiceNo') {
        qbOrdered = qbOrdered.addOrderBy('inv.invoice_no', orderDirection);
      }

      const searchResults = await qbOrdered
        .addOrderBy('inv.created_at', 'DESC')
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();

      const mappedItems = await this.loadNetOffAmounts(searchResults[0]);

      return {
        items: mappedItems.map((i: any) => this.toDto(i)),
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

    const mappedItems = await this.loadNetOffAmounts(items);

    return {
      items: mappedItems.map((i: any) => this.toDto(i)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const data = await this.repository.findOne({
      where: { id, isDeleted: false },
      relations: ['items', 'voucherNetOffs', 'voucherNetOffs.bankTransaction'],
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

    this.extractInvoiceMetadata(invoice);

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
      await this.repository.manager.delete(ErpInvoiceItem, { invoiceId: id });
      const newItems = dto.items.map((i) =>
        this.repository.manager.create(ErpInvoiceItem, {
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
      await this.repository.manager.save(ErpInvoiceItem, newItems);
      delete (existing as any).items;
    }

    this.extractInvoiceMetadata(existing);

    await this.repository.save(existing);

    // Refresh journal entries for any linked bank transactions in case branchId or description changed
    const netOffs = await this.repository.manager.find(
      ErpInvoiceVoucherNetOff,
      {
        where: { invoiceId: id },
      },
    );
    if (netOffs && netOffs.length > 0) {
      const uniqueTxnIds = [
        ...new Set(netOffs.map((n) => n.bankTransactionId)),
      ];
      for (const txnId of uniqueTxnIds) {
        await this.bankTransactionsCoreService.refreshJournalEntriesForBankTransaction(
          txnId,
        );
      }
    }

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
      netOffAmount: (invoice as any).netOffAmount || '0',
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
      voucherNetOffs: invoice.voucherNetOffs,
    };
  }

  async linkVouchersToInvoice(
    invoiceId: string,
    payload: { bankTransactionId: string; netOffAmount?: number }[],
  ) {
    const invoice = await this.repository.findOne({
      where: { id: invoiceId, isDeleted: false },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);
    }

    const netOffEntities = payload.map((p) =>
      this.repository.manager.create(ErpInvoiceVoucherNetOff, {
        invoiceId,
        bankTransactionId: p.bankTransactionId,
        netOffAmount: p.netOffAmount ?? 0,
      }),
    );

    await this.repository.manager.save(ErpInvoiceVoucherNetOff, netOffEntities);

    // Refresh journal entries for each affected bank transaction
    const uniqueTxnIds = [...new Set(payload.map((p) => p.bankTransactionId))];
    for (const txnId of uniqueTxnIds) {
      await this.bankTransactionsCoreService.refreshJournalEntriesForBankTransaction(
        txnId,
      );
    }

    return { message: 'Đã liên kết phiếu thành công' };
  }

  async removeVoucherFromInvoice(invoiceId: string, voucherId: string) {
    await this.repository.manager.delete(ErpInvoiceVoucherNetOff, {
      invoiceId,
      bankTransactionId: voucherId,
    });

    // Refresh journal entries for the affected bank transaction
    await this.bankTransactionsCoreService.refreshJournalEntriesForBankTransaction(
      voucherId,
    );

    return { message: 'Đã xóa liên kết phiếu thành công' };
  }

  /**
   * POST /portal/sync
   * Lấy danh sách hóa đơn từ GDT portal, lưu vào DB (skip trùng),
   * sau đó download XML theo batch 10 với delay ngẫu nhiên 5-10s.
   */
  async syncFromPortal(dto: PortalFetchDto) {
    let token = dto.token?.trim();
    if (!token) {
      token = await this.getPortalToken();
    }
    if (!token) throw new BadRequestException('token is required');
    if (!dto.dateFrom || !dto.dateTo) {
      throw new BadRequestException('dateFrom and dateTo are required');
    }

    const type = dto.type ?? 'purchase';
    const direction: 'IN' | 'OUT' = type === 'purchase' ? 'IN' : 'OUT';

    // Build GDT URLs (support both standard and cash register invoices)
    const basePaths =
      type === 'purchase'
        ? [
            'https://hoadondientu.gdt.gov.vn/api/query/invoices/purchase',
            'https://hoadondientu.gdt.gov.vn/api/sco-query/invoices/purchase',
          ]
        : [
            'https://hoadondientu.gdt.gov.vn/api/query/invoices/sold',
            'https://hoadondientu.gdt.gov.vn/api/sco-query/invoices/sold',
          ];

    const [fromY, fromM, fromD] = dto.dateFrom.split('-');
    const formattedDateFrom = `${fromD}/${fromM}/${fromY}`;
    const [toY, toM, toD] = dto.dateTo.split('-');
    const formattedDateTo = `${toD}/${toM}/${toY}`;

    // Run the sync process in the background
    (async () => {
      try {
        const rawItems: any[] = [];
        let totalFromPortal = 0;
        let pagesFetched = 0;
        const maxPages = 50; // max pages per endpoint

        for (const basePath of basePaths) {
          let state: string | null = null;
          let pathPagesFetched = 0;

          do {
            const url = new URL(basePath);
            url.searchParams.set('sort', 'tdlap:desc');
            url.searchParams.set('size', '50');
            url.searchParams.set(
              'search',
              `tdlap=ge=${formattedDateFrom}T00:00:00;tdlap=le=${formattedDateTo}T23:59:59`,
            );
            if (state) {
              url.searchParams.set('state', state);
            }

            this.progress$.next({
              processId: 'sync-progress',
              type: 'bulk',
              total: 100, // Unknown total pages initially
              current: pagesFetched,
              message: `Đang lấy danh sách hóa đơn từ cơ quan thuế (trang ${pagesFetched + 1})...`,
              completed: false,
            });

            const response = await this.fetchWithRetry(url, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok)
              throw new BadRequestException(
                `Portal request failed with status ${response.status}`,
              );

            const payload = (await response.json()) as {
              datas?: any[];
              total?: number;
              state?: string;
            };

            if (pathPagesFetched === 0) {
              totalFromPortal += payload.total ?? 0;
            }

            if (payload.datas && payload.datas.length > 0) {
              rawItems.push(...payload.datas);
            }

            state = payload.state ?? null;
            pathPagesFetched++;
            pagesFetched++;

            if (state && pathPagesFetched < maxPages) {
              const delay = (2 + Math.random() * 3) * 1000;
              await this.sleep(Math.round(delay));
            }
          } while (state && pathPagesFetched < maxPages);
        }

        // ── Save new invoices to DB ───────────────────────────────────────────────
        let created = 0;
        let skipped = 0;
        const errors: string[] = [];
        const backgroundSyncIds: string[] = []; // track for XML and Detail download

        for (const raw of rawItems) {
          try {
            const invoiceNo = String(raw.shdon ?? '');
            const serialNo = raw.khhdon ?? null;

            const existing = await this.repository.findOne({
              where: { invoiceNo, serialNo, direction, isDeleted: false },
            });
            if (existing) {
              // Self-heal: Nếu hóa đơn cũ thiếu XML hoặc thiếu Diễn giải -> Xếp hàng tải lại
              if (!existing.xmlFileKey || !existing.description) {
                backgroundSyncIds.push(existing.id);
              }
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

            this.extractInvoiceMetadata(invoice);

            const saved = (await this.repository.save(
              invoice,
            )) as unknown as ErpInvoice;
            backgroundSyncIds.push(saved.id);
            created++;
          } catch (err) {
            errors.push((err as Error).message);
          }
        }

        this.progress$.next({
          processId: 'sync-progress',
          type: 'bulk',
          total: rawItems.length,
          current: rawItems.length,
          message: `Đã lấy xong ${rawItems.length} hóa đơn. Đang chuyển sang tải chi tiết...`,
          completed: false,
        });

        // ── XML background download (fire & forget, rate-limited) ─────────────────
        if (backgroundSyncIds.length > 0) {
          this.downloadXmlsInBackground(backgroundSyncIds, token).catch((e) =>
            this.logger.error('XML background download failed', e),
          );
        }

        this.logger.log(
          `Background portal sync completed. Fetched: ${rawItems.length}, Imported: ${created}, Skipped: ${skipped}`,
        );
      } catch (err) {
        this.logger.error('Background portal sync failed', err);
      }
    })();

    return {
      totalItemsFetched: 0,
      totalFromPortal: 0,
      pagesFetched: 0,
      imported: 0,
      skipped: 0,
      direction,
      errors: [],
      xmlDownloadQueued: 0,
      note: 'Tiến trình đồng bộ đang chạy ngầm trên máy chủ. Vui lòng chờ ít phút.',
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
    const processId = 'sync-progress';
    const BATCH_SIZE = 10;
    const invoices = await this.repository.findByIds(invoiceIds);
    const targets = invoices.filter(
      (inv) => !inv.xmlFileKey || !inv.description,
    );

    const total = targets.length;
    if (total === 0) return;

    this.progress$.next({
      processId,
      type: 'sync',
      total,
      current: 0,
      message: `Đang tải chi tiết & XML (0/${total})...`,
      completed: false,
    });

    let current = 0;

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map((inv) => this.downloadAndSaveXml(inv, token)),
      );

      current += batch.length;
      this.progress$.next({
        processId,
        type: 'sync',
        total,
        current,
        message: `Đang tải chi tiết & XML (${current}/${total})...`,
        completed: false,
      });

      // Random sleep 5-10s giữa batch (trừ batch cuối)
      if (i + BATCH_SIZE < targets.length) {
        const delay = (5 + Math.random() * 5) * 1000;
        await this.sleep(Math.round(delay));
      }
    }

    this.progress$.next({
      processId,
      type: 'sync',
      total,
      current,
      message: `Đã hoàn tất tải ${total} hóa đơn!`,
      completed: true,
    });

    this.logger.log(`XML download complete: ${targets.length} files processed`);
  }

  private async downloadAndSaveXml(
    invoice: ErpInvoice,
    token: string,
  ): Promise<void> {
    // 1. Luôn ưu tiên lấy chi tiết từ API JSON trước
    await this.syncInvoiceDetailFromJson(invoice, token);

    // 2. Tải XML để làm chứng từ (nếu lỗi thì bỏ qua)
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

      let xmlString = '';
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

      let notesToAppend = '';
      if (xmlString) {
        try {
          const parsedXml = parseVietnamInvoiceXml(xmlString);
          if (parsedXml.lookupCode || parsedXml.providerLink) {
            notesToAppend = `[Lookup Info] Code: ${parsedXml.lookupCode ?? 'N/A'} - Link: ${parsedXml.providerLink ?? 'N/A'}`;
          }
        } catch (e) {
          // ignore
        }
      }

      await this.r2.uploadBuffer(xmlKey, xmlBuffer, contentType);

      const updateData: any = { xmlFileKey: xmlKey };
      if (notesToAppend && !(invoice.notes || '').includes(notesToAppend)) {
        updateData.notes = invoice.notes
          ? invoice.notes + '\n' + notesToAppend
          : notesToAppend;
      }

      await this.repository.update(invoice.id, updateData);
      this.logger.log(`XML saved for invoice ${invoice.invoiceNo}: ${xmlKey}`);
    } catch (err) {
      this.logger.warn(
        `downloadAndSaveXml error for ${invoice.invoiceNo}: ${(err as Error).message}`,
      );
    }
  }

  async reparseXml(id: string, token?: string): Promise<ErpInvoice> {
    let activeToken = token?.trim();
    if (!activeToken) {
      activeToken = await this.getPortalToken();
    }
    const invoiceResp = await this.findOne(id);
    let invoice = invoiceResp.data;

    if (!invoice.xmlFileKey) {
      if (!activeToken) {
        throw new BadRequestException(
          'Hóa đơn này chưa có file XML đính kèm và không có token portal để tự tải.',
        );
      }
      await this.downloadAndSaveXml(invoice as any, activeToken);
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

      let newNotes = invoice.notes || '';
      if (parsedXml.lookupCode || parsedXml.providerLink) {
        const infoStr = `[Lookup Info] Code: ${parsedXml.lookupCode ?? 'N/A'} - Link: ${parsedXml.providerLink ?? 'N/A'}`;
        if (!newNotes.includes(infoStr)) {
          newNotes = newNotes ? newNotes + '\n' + infoStr : infoStr;
        }
      }

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
        notes: newNotes || undefined,
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

  async bulkDownloadXml(token: string | undefined, direction: 'IN' | 'OUT') {
    let activeToken = token?.trim();
    if (!activeToken) {
      activeToken = await this.getPortalToken();
    }
    if (!activeToken) throw new BadRequestException('token is required');
    if (!token) throw new BadRequestException('Token portal là bắt buộc.');

    const invoices = await this.repository.find({
      where: [
        { source: 'PORTAL', direction, xmlFileKey: IsNull(), isDeleted: false },
        {
          source: 'PORTAL',
          direction,
          description: IsNull(),
          isDeleted: false,
        },
      ],
    });

    const total = invoices.length;

    if (total === 0) {
      return {
        message: 'Không có hóa đơn nào thiếu XML hoặc Diễn giải cần tải lại.',
        count: 0,
      };
    }

    const processId = 'sync-progress';

    // Chạy ngầm
    (async () => {
      this.logger.log(`Bắt đầu tải nền XML cho ${total} hóa đơn`);

      this.progress$.next({
        processId,
        type: 'bulk',
        total,
        current: 0,
        message: `Đang tải chi tiết & XML hàng loạt (0/${total})...`,
        completed: false,
      });

      let current = 0;

      for (const inv of invoices) {
        try {
          await this.downloadAndSaveXml(inv as any, activeToken);
          current++;

          this.progress$.next({
            processId,
            type: 'bulk',
            total,
            current,
            message: `Đang tải chi tiết & XML hàng loạt (${current}/${total})...`,
            completed: false,
          });

          await new Promise((r) => setTimeout(r, 500)); // Ngừng 0.5s để tránh rate limit
        } catch (e) {
          this.logger.warn(
            `Lỗi tải XML cho ${inv.invoiceNo}: ${(e as Error).message}`,
          );
        }
      }

      this.progress$.next({
        processId,
        type: 'bulk',
        total,
        current,
        message: `Đã hoàn tất tải hàng loạt ${total} hóa đơn!`,
        completed: true,
      });

      this.logger.log(`Hoàn thành tải nền XML cho ${total} hóa đơn`);
    })().catch((err) => {
      this.logger.error('Lỗi khi chạy background bulk download', err);
    });

    return {
      message: `Đang tải lại XML ngầm cho ${invoices.length} hóa đơn. Vui lòng chờ ít phút.`,
      count: invoices.length,
    };
  }

  async syncDetailFromPortal(id: string, token?: string): Promise<ErpInvoice> {
    let activeToken = token?.trim();
    if (!activeToken) {
      activeToken = await this.getPortalToken();
    }
    if (!activeToken)
      throw new BadRequestException('Token portal là bắt buộc.');
    const invoiceResp = await this.findOne(id);
    const invoice = invoiceResp.data as any;

    await this.syncInvoiceDetailFromJson(invoice, activeToken);
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
        description: items.length > 0 ? items[0].description : undefined,
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
    if (!isoDate) return '';
    try {
      // GDT trả về ISO: "2026-07-01T17:00:00Z" (UTC). Shift to GMT+7.
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return isoDate.slice(0, 10);
      const tzDate = new Date(date.getTime() + 7 * 3600 * 1000);
      return tzDate.toISOString().slice(0, 10);
    } catch {
      return isoDate.slice(0, 10);
    }
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
        let notes = '';
        if (parsed.lookupCode || parsed.providerLink) {
          notes = `[Lookup Info] Code: ${parsed.lookupCode ?? 'N/A'} - Link: ${parsed.providerLink ?? 'N/A'}`;
        }

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
          notes: notes || undefined,
          preVatAmount: String(parsed.preVatAmount),
          vatRate: parsed.vatRate != null ? String(parsed.vatRate) : null,
          vatAmount: String(parsed.vatAmount),
          discountAmount: String(parsed.discountAmount),
          totalAmount: String(parsed.totalAmount),
          xmlFileKey: xmlKey,
          xmlImportId: importId,
        } as any);

        this.extractInvoiceMetadata(invoice);

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

  async uploadPdfs(
    invoiceId: string,
    files: { filename: string; buffer: Buffer; mimetype: string }[],
  ) {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const safeNo = invoice.invoiceNo.replace(/[^\w-]/g, '_');

    let pdfFiles = Array.isArray(invoice.pdfFiles) ? [...invoice.pdfFiles] : [];

    const uploadPromises = files.map(async (file, index) => {
      const ts = Date.now();
      const safeFilename = file.filename.replace(/[^\w.-]/g, '_');
      const key = `invoices/${invoice.direction}/${yyyy}/${mm}/${safeNo}_${ts}_${index}_${safeFilename}`;
      await this.r2.uploadBuffer(
        key,
        file.buffer,
        file.mimetype || 'application/pdf',
      );

      return {
        key,
        filename: file.filename,
        uploadedAt: new Date().toISOString(),
      };
    });

    const newFiles = await Promise.all(uploadPromises);
    pdfFiles = [...pdfFiles, ...newFiles];

    await this.repository.update(invoiceId, { pdfFiles } as any);
    return { success: true, pdfFiles };
  }

  async getPdfDownloadUrl(invoiceId: string, fileKey: string, inline = false) {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const file = Array.isArray(invoice.pdfFiles)
      ? invoice.pdfFiles.find((f) => f.key === fileKey)
      : null;
    const filename = file ? file.filename : 'document.pdf';

    const url = await this.r2.getPresignedDownloadUrl(
      fileKey,
      3600,
      filename,
      inline,
    );
    return { url };
  }

  async downloadAllPdfsZip(invoiceId: string): Promise<Buffer> {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const files = Array.isArray(invoice.pdfFiles) ? invoice.pdfFiles : [];
    if (files.length === 0) {
      if (invoice.pdfFileKey) {
        files.push({ key: invoice.pdfFileKey, filename: 'document.pdf' });
      } else {
        throw new NotFoundException(
          `Invoice ${invoiceId} không có file PDF nào`,
        );
      }
    }

    const zip = new AdmZip();
    for (const file of files) {
      try {
        const buffer = await this.r2.downloadBuffer(file.key);
        let safeFilename = file.filename || 'document.pdf';
        // Prevent duplicate filenames in zip
        while (zip.getEntry(safeFilename)) {
          const match = safeFilename.match(/(.*)(\.[^.]+)$/);
          if (match) {
            safeFilename = `${match[1]}_1${match[2]}`;
          } else {
            safeFilename = `${safeFilename}_1`;
          }
        }
        zip.addFile(safeFilename, buffer);
      } catch (err) {
        console.error(`Failed to download ${file.key} for zip`, err);
      }
    }

    return zip.toBuffer();
  }

  async deletePdf(invoiceId: string, fileKey: string) {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    let pdfFiles = Array.isArray(invoice.pdfFiles) ? [...invoice.pdfFiles] : [];
    pdfFiles = pdfFiles.filter((f) => f.key !== fileKey);

    await this.r2.deleteObject(fileKey).catch(() => {});
    await this.repository.update(invoiceId, { pdfFiles } as any);

    return { success: true, pdfFiles };
  }

  async exportExcel(query: ErpInvoiceQuery): Promise<Buffer> {
    const qb = this.repository
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.items', 'items')
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
        dateTo:
          query.date_to?.length === 10
            ? `${query.date_to} 23:59:59.999`
            : query.date_to,
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
    if (query.tag_id) {
      qb.andWhere(
        `inv.id IN (SELECT entity_id FROM sys_entity_tags WHERE entity_type = 'erp_invoice' AND tag_id = :tagId)`,
        { tagId: query.tag_id },
      );
    }

    let orderColumn = 'inv.invoice_date';
    let orderDirection: 'ASC' | 'DESC' = 'DESC';
    if (query.sort_by) {
      if (query.sort_by === 'invoiceNo') orderColumn = 'inv.invoice_no';
      else if (query.sort_by === 'totalAmount')
        orderColumn = 'inv.total_amount';
      else if (query.sort_by === 'sellerName') orderColumn = 'inv.seller_name';
      else if (query.sort_by === 'buyerName') orderColumn = 'inv.buyer_name';
      else if (query.sort_by === 'status') orderColumn = 'inv.status';
    }
    if (query.sort_order) {
      orderDirection = query.sort_order.toUpperCase() as 'ASC' | 'DESC';
    }

    qb.orderBy(orderColumn, orderDirection).addOrderBy(
      'inv.created_at',
      'DESC',
    );

    const items = await qb.getMany();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invoices');

    const isDetailed = query.export_type === 'detailed';

    if (isDetailed) {
      worksheet.columns = [
        { header: 'Ngày phát hành', key: 'invoiceDate', width: 15 },
        { header: 'Ký hiệu hóa đơn', key: 'serialNo', width: 15 },
        { header: 'Số hóa đơn', key: 'invoiceNo', width: 15 },
        { header: 'Tên đơn vị khách hàng', key: 'partnerName', width: 40 },
        { header: 'MST khách hàng', key: 'taxCode', width: 15 },
        { header: 'Tên hàng hóa, dịch vụ', key: 'itemName', width: 40 },
        { header: 'Đơn vị tính', key: 'uom', width: 15 },
        {
          header: 'Số lượng',
          key: 'qty',
          width: 15,
          style: { numFmt: '#,##0.###' },
        },
        {
          header: 'Đơn giá',
          key: 'unitPrice',
          width: 20,
          style: { numFmt: '#,##0' },
        },
        {
          header: 'Thành tiền',
          key: 'totalAmount',
          width: 20,
          style: { numFmt: '#,##0' },
        },
        {
          header: 'Thuế suất VAT (%)',
          key: 'vatRate',
          width: 15,
          style: { numFmt: '0%' },
        },
        {
          header: 'Tiền thuế VAT',
          key: 'vatAmount',
          width: 20,
          style: { numFmt: '#,##0' },
        },
        { header: 'Biển số xe', key: 'licensePlate', width: 15 },
        { header: 'Lệnh quyết toán', key: 'wo', width: 30 },
      ];
    } else {
      worksheet.columns = [
        { header: 'Ngày phát hành', key: 'invoiceDate', width: 15 },
        { header: 'Ký hiệu hóa đơn', key: 'serialNo', width: 15 },
        { header: 'Số hóa đơn', key: 'invoiceNo', width: 15 },
        { header: 'Tên đơn vị khách hàng', key: 'partnerName', width: 40 },
        { header: 'MST khách hàng', key: 'taxCode', width: 15 },
        { header: 'Địa chỉ khách hàng', key: 'address', width: 50 },
        {
          header: 'Tiền trước VAT',
          key: 'preVat',
          width: 20,
          style: { numFmt: '#,##0' },
        },
        { header: 'VAT', key: 'vat', width: 15, style: { numFmt: '#,##0' } },
        {
          header: 'Sau VAT',
          key: 'total',
          width: 20,
          style: { numFmt: '#,##0' },
        },
        { header: 'Biển số xe', key: 'licensePlate', width: 15 },
        { header: 'Lệnh quyết toán', key: 'wo', width: 30 },
        { header: 'Diễn giải', key: 'description', width: 50 },
      ];
    }

    // Style header
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    });

    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' },
    ];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columns.length },
    };

    for (const inv of items) {
      const partnerName =
        query.direction === 'IN' ? inv.sellerName : inv.buyerName;
      const taxCode =
        query.direction === 'IN' ? inv.sellerTaxCode : inv.buyerTaxCode;
      const address =
        query.direction === 'IN' ? inv.sellerAddress : inv.buyerAddress;

      const parseVat = (val: any) => {
        if (!val) return '';
        const n = parseFloat(val);
        return isNaN(n) ? val : n / 100;
      };

      if (isDetailed) {
        if (!inv.items || inv.items.length === 0) {
          // If no items, output a single row with empty item details
          worksheet.addRow({
            invoiceDate: inv.invoiceDate,
            serialNo: inv.serialNo,
            invoiceNo: inv.invoiceNo,
            partnerName,
            taxCode,
            itemName: inv.description || '',
            uom: '',
            qty: 0,
            unitPrice: 0,
            totalAmount: Number(inv.preVatAmount) || 0,
            vatRate: parseVat(inv.vatRate),
            vatAmount: Number(inv.vatAmount) || 0,
            licensePlate: inv.licensePlate || '',
            wo: inv.settlementOrder || '',
          });
        } else {
          for (const item of inv.items) {
            worksheet.addRow({
              invoiceDate: inv.invoiceDate,
              serialNo: inv.serialNo,
              invoiceNo: inv.invoiceNo,
              partnerName,
              taxCode,
              itemName: item.description || '',
              uom: item.unit || '',
              qty: Number(item.quantity) || 0,
              unitPrice: Number(item.unitPrice) || 0,
              totalAmount: Number(item.preVatAmount) || 0,
              vatRate: parseVat(item.vatRate || inv.vatRate),
              vatAmount: Number(item.vatAmount) || 0,
              licensePlate: inv.licensePlate || '',
              wo: inv.settlementOrder || '',
            });
          }
        }
      } else {
        const fullDesc = [
          inv.description,
          (inv as any).notes,
          ...(inv.items || []).map((i) => i.description),
        ]
          .filter(Boolean)
          .join(' | ');

        worksheet.addRow({
          invoiceDate: inv.invoiceDate,
          serialNo: inv.serialNo,
          invoiceNo: inv.invoiceNo,
          partnerName,
          taxCode,
          address,
          preVat: Number(inv.preVatAmount) || 0,
          vat: Number(inv.vatAmount) || 0,
          total: Number(inv.totalAmount) || 0,
          licensePlate: inv.licensePlate || '',
          wo: inv.settlementOrder || '',
          description: fullDesc,
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as any;
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
