import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { TaxPortalSyncQueryDto } from './dto/sinvoice.dto';
import {
  CreateSinvoiceDraftDto,
  ListSinvoiceDraftQueryDto,
  SaveSinvoiceConfigDto,
} from './dto/sinvoice-draft.dto';
import { SinvoiceConfig } from './entities/sinvoice-config.entity';
import { SinvoiceDraft } from './entities/sinvoice-draft.entity';
import { sleep } from '../common/utils/delay.util';
import { applyMultiKeywordFilter } from '../common/utils/query-builder.util';

type FileType = 'PDF' | 'XML' | 'ZIP';
type InvoiceDirection = 'IN' | 'OUT';

@Injectable()
export class SinvoiceService {
  private readonly logger = new Logger(SinvoiceService.name);

  constructor(
    @InjectRepository(SinvoiceConfig)
    private readonly configRepo: Repository<SinvoiceConfig>,
    @InjectRepository(SinvoiceDraft)
    private readonly draftRepo: Repository<SinvoiceDraft>,
  ) {}

  // ─────────────────────────── SINVOICE CONFIG ────────────────────────────

  private normalizeConfig(row: SinvoiceConfig) {
    return {
      id: row.id,
      supplierTaxCode: row.supplierTaxCode,
      username: row.username,
      password: row.password,
      appKey: row.appKey,
      apiUrl:
        row.apiUrl ??
        'https://api-vinvoice.viettel.vn/services/einvoiceapplication/api/',
      environment: row.environment ?? 'production',
      isActive: row.isActive,
    };
  }

  async getConfig() {
    const row = await this.configRepo.findOne({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
    });
    if (!row)
      throw new BadRequestException('Chưa cấu hình SInvoice trong hệ thống');
    return this.normalizeConfig(row);
  }

  async getConfigEndpoint() {
    const row = await this.configRepo.findOne({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
    });
    if (!row || !row.supplierTaxCode) return null;
    return {
      supplierTaxCode: row.supplierTaxCode,
      username: row.username,
      password: row.password,
      apiUrl: row.apiUrl,
      environment: row.environment,
    };
  }

  async saveConfig(dto: SaveSinvoiceConfigDto) {
    // Upsert: deactivate all, then upsert the new config
    await this.configRepo.update({}, { isActive: false });

    let existing = await this.configRepo.findOne({ where: {} });
    if (existing) {
      existing.supplierTaxCode =
        dto.supplierTaxCode ?? existing.supplierTaxCode;
      existing.username = dto.username ?? existing.username;
      existing.password = dto.password ?? existing.password;
      existing.appKey = dto.appKey ?? existing.appKey;
      existing.apiUrl =
        dto.apiUrl ??
        existing.apiUrl ??
        'https://api-vinvoice.viettel.vn/services/einvoiceapplication/api/';
      existing.environment =
        dto.environment ?? existing.environment ?? 'production';
      existing.isActive = true;
      await this.configRepo.save(existing);
    } else {
      existing = this.configRepo.create({
        supplierTaxCode: dto.supplierTaxCode ?? null,
        username: dto.username ?? null,
        password: dto.password ?? null,
        appKey: dto.appKey ?? null,
        apiUrl:
          dto.apiUrl ??
          'https://api-vinvoice.viettel.vn/services/einvoiceapplication/api/',
        environment: dto.environment ?? 'production',
        isActive: true,
      });
      await this.configRepo.save(existing);
    }

    const connection = await this.testSinvoiceConnectionWithConfig({
      supplierTaxCode: existing.supplierTaxCode,
      username: existing.username,
      password: existing.password,
      apiUrl: existing.apiUrl,
    });

    return { ok: true, data: this.normalizeConfig(existing), connection };
  }

  async resetConfig() {
    await this.configRepo.update({}, { isActive: false });
    return { ok: true };
  }

  // ─────────────────────────── SINVOICE DRAFTS ────────────────────────────

  async listDrafts(query: ListSinvoiceDraftQueryDto) {
    const page = Math.max(Number(query.page ?? 1) || 1, 1);
    const pageSize = Math.min(
      Math.max(Number(query.pageSize ?? 15) || 15, 1),
      100,
    );
    const skip = (page - 1) * pageSize;

    const qb = this.draftRepo.createQueryBuilder('draft');

    if (query.status) {
      qb.andWhere('draft.status = :status', { status: query.status });
    }

    if (query.dateFrom) {
      qb.andWhere('draft.createdAt >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }

    if (query.dateTo) {
      qb.andWhere('draft.createdAt <= :dateTo', {
        dateTo: new Date(query.dateTo),
      });
    }

    if (query.filtersStr) {
      try {
        const filters = JSON.parse(query.filtersStr) as Record<
          string,
          string[]
        >;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          let filterField = '';
          if (col === 'createdAt')
            filterField = `TO_CHAR(draft.created_at, 'YYYY-MM-DD')`;
          else if (col === 'documentNo') filterField = 'draft.document_no';
          else if (col === 'buyerName') filterField = 'draft.buyer_name';
          else if (col === 'buyerTaxCode') filterField = 'draft.buyer_tax_code';
          else if (col === 'status') filterField = 'draft.status';
          else if (col === 'totalAmount') filterField = 'draft.total_amount';
          else if (col === 'vatAmount') filterField = 'draft.vat_amount';
          else if (col === 'discountAmount')
            filterField = 'draft.discount_amount';
          else if (col === 'amountWithoutVAT')
            filterField =
              '(COALESCE(draft.total_amount, 0) - COALESCE(draft.vat_amount, 0))';
          else if (col === 'vatRate')
            filterField =
              "CONCAT(COALESCE(ROUND((COALESCE(draft.vat_amount, 0) / NULLIF(COALESCE(draft.total_amount, 0) - COALESCE(draft.vat_amount, 0), 0)) * 100), 0), '%')";

          if (filterField) {
            qb.andWhere(`CAST(${filterField} AS TEXT) IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (query.search) {
      const search = query.search;
      qb.andWhere(
        '(draft.buyerName ILIKE :search OR draft.documentNo ILIKE :search OR draft.buyerTaxCode ILIKE :search)',
        {
          search: `%${search}%`,
        },
      );
    }

    if (query.sortKey) {
      let sortKey = query.sortKey;
      if (sortKey === 'createdAt')
        sortKey = "(draft.response_payload->>'createdDate')::timestamp";
      else if (sortKey === 'documentNo') sortKey = 'draft.document_no';
      else if (sortKey === 'buyerName') sortKey = 'draft.buyer_name';
      else if (sortKey === 'buyerPersonName')
        sortKey = "draft.response_payload->>'buyerName'";
      else if (sortKey === 'buyerTaxCode') sortKey = 'draft.buyer_tax_code';
      else if (sortKey === 'status') sortKey = 'draft.status';
      else if (sortKey === 'totalAmount') sortKey = 'draft.total_amount';
      else if (sortKey === 'vatAmount') sortKey = 'draft.vat_amount';
      else if (sortKey === 'discountAmount') sortKey = 'draft.discount_amount';
      else if (sortKey === 'amountWithoutVAT')
        sortKey =
          '(COALESCE(draft.total_amount, 0) - COALESCE(draft.vat_amount, 0))';
      else sortKey = `draft.${sortKey}`;
      qb.orderBy(
        sortKey,
        query.sortDirection?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
      );
    } else {
      qb.orderBy("(draft.response_payload->>'createdDate')::timestamp", 'DESC');
    }
    qb.skip(skip).take(pageSize);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
    };
  }

  async getDraftColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    const qb = this.draftRepo.createQueryBuilder('draft');

    let selectField = '';
    let isDateColumn = false;

    if (column === 'createdAt') {
      selectField =
        "TO_CHAR((draft.response_payload->>'createdDate')::timestamp, 'YYYY-MM-DD')";
      isDateColumn = true;
    } else if (column === 'documentNo') selectField = 'draft.document_no';
    else if (column === 'buyerName') selectField = 'draft.buyer_name';
    else if (column === 'buyerPersonName')
      selectField = "draft.response_payload->>'buyerName'";
    else if (column === 'buyerTaxCode') selectField = 'draft.buyer_tax_code';
    else if (column === 'status') selectField = 'draft.status';
    else if (column === 'totalAmount') selectField = 'draft.total_amount';
    else if (column === 'vatAmount') selectField = 'draft.vat_amount';
    else if (column === 'discountAmount') selectField = 'draft.discount_amount';
    else if (column === 'amountWithoutVAT')
      selectField =
        '(COALESCE(draft.total_amount, 0) - COALESCE(draft.vat_amount, 0))';
    else if (column === 'vatRate')
      selectField =
        "CONCAT(COALESCE(ROUND((COALESCE(draft.vat_amount, 0) / NULLIF(COALESCE(draft.total_amount, 0) - COALESCE(draft.vat_amount, 0), 0)) * 100), 0), '%')";
    else return { items: [], total: 0, page, pageSize, totalPages: 0 };

    qb.select(`DISTINCT ${selectField}`, 'value');
    if (isDateColumn) {
      qb.andWhere('draft.created_at IS NOT NULL');
      qb.andWhere(`${selectField} != ''`);
    } else {
      qb.andWhere(`${selectField} IS NOT NULL`);
      qb.andWhere(`CAST(${selectField} AS TEXT) != ''`);
    }

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue;

          let filterField = '';
          if (col === 'createdAt')
            filterField = `TO_CHAR((draft.response_payload->>'createdDate')::timestamp, 'YYYY-MM-DD')`;
          else if (col === 'documentNo') filterField = 'draft.document_no';
          else if (col === 'buyerName') filterField = 'draft.buyer_name';
          else if (col === 'buyerPersonName')
            filterField = "draft.response_payload->>'buyerName'";
          else if (col === 'buyerTaxCode') filterField = 'draft.buyer_tax_code';
          else if (col === 'status') filterField = 'draft.status';
          else if (col === 'totalAmount') filterField = 'draft.total_amount';
          else if (col === 'vatAmount') filterField = 'draft.vat_amount';
          else if (col === 'discountAmount')
            filterField = 'draft.discount_amount';
          else if (col === 'amountWithoutVAT')
            filterField =
              '(COALESCE(draft.total_amount, 0) - COALESCE(draft.vat_amount, 0))';
          else if (col === 'vatRate')
            filterField =
              "CONCAT(COALESCE(ROUND((COALESCE(draft.vat_amount, 0) / NULLIF(COALESCE(draft.total_amount, 0) - COALESCE(draft.vat_amount, 0), 0)) * 100), 0), '%')";

          if (filterField) {
            qb.andWhere(`CAST(${filterField} AS TEXT) IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          }
        }
      } catch {
        // ignore malformed filters
      }
    }

    if (search) {
      applyMultiKeywordFilter(
        qb,
        `CAST(${selectField} AS TEXT)`,
        search,
        'search',
      );
    }

    qb.orderBy('value', 'ASC');

    const totalRaw = await qb
      .clone()
      .orderBy()
      .select(`COUNT(DISTINCT ${selectField})`, 'cnt')
      .getRawOne();
    const total = parseInt(totalRaw?.cnt || '0', 10);

    qb.offset((page - 1) * pageSize).limit(pageSize);
    const results = await qb.getRawMany();
    const items = results.map((r) => r.value).filter(Boolean);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createDraft(dto: CreateSinvoiceDraftDto) {
    let config: any = null;
    try {
      config = await this.getConfig();
    } catch {
      throw new BadRequestException(
        'Chưa cấu hình SInvoice. Không thể tạo nháp.',
      );
    }
    if (!config.supplierTaxCode || !config.apiUrl) {
      throw new BadRequestException('Chưa cấu hình API URL hoặc Mã số thuế.');
    }

    const lines = (
      dto.lines?.length
        ? dto.lines
        : [
            {
              description: dto.description ?? 'Hóa đơn nháp ERP',
              quantity: 1,
              unitPrice: 0,
              taxRate: 10,
            },
          ]
    ).map((line, index) => {
      const quantity = Number(line.quantity ?? 1);
      const unitPrice = Number(line.unitPrice ?? 0);
      const taxRate = Number(line.taxRate ?? 0);
      const amountWithoutTax = quantity * unitPrice;
      const taxAmount = amountWithoutTax * (taxRate / 100);
      return {
        lineNumber: index + 1,
        itemName: line.description ?? line.itemName ?? `Dòng hàng ${index + 1}`,
        quantity,
        unitPrice,
        taxRate,
        amountWithoutTax,
        taxAmount,
      };
    });

    const totalWithoutTax = lines.reduce(
      (sum, l) => sum + l.amountWithoutTax,
      0,
    );
    const totalTaxAmount = lines.reduce((sum, l) => sum + l.taxAmount, 0);
    const totalAmountWithTax = totalWithoutTax + totalTaxAmount;

    const documentNo = dto.documentNo ?? `DRAFT-${Date.now()}`;

    const payload = {
      generalInvoiceInfo: {
        invoiceType: '01GTKT',
        templateCode: '',
        invoiceSeries: '',
        currencyCode: dto.currencyCode ?? 'VND',
        adjustmentType: '1',
        paymentStatus: true,
        paymentType: 'TM/CK',
        cusGetInvoiceRight: true,
        buyerName: dto.buyerName ?? 'Khách hàng',
        buyerTaxCode: dto.buyerTaxCode ?? '',
        buyerAddressLine: dto.buyerAddress ?? '',
        transactionUuid: documentNo,
      },
      buyerInfo: {
        buyerName: dto.buyerName ?? 'Khách hàng',
        buyerLegalName: dto.buyerName ?? 'Khách hàng',
        buyerTaxCode: dto.buyerTaxCode ?? '',
        buyerAddressLine: dto.buyerAddress ?? '',
        buyerEmail: dto.buyerEmail ?? '',
      },
      itemInfo: lines.map((line, index) => ({
        lineNumber: index + 1,
        itemName: line.itemName,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        itemTotalAmountWithoutTax: line.amountWithoutTax,
        taxPercentage: line.taxRate,
        taxAmount: line.taxAmount,
        discount: 0,
        itemTotalAmountWithTax: line.amountWithoutTax + line.taxAmount,
      })),
      summarizeInfo: {
        sumOfTotalLineAmountWithoutTax: totalWithoutTax,
        totalAmountWithoutTax: totalWithoutTax,
        totalTaxAmount: totalTaxAmount,
        totalAmountWithTax: totalAmountWithTax,
        discountAmount: 0,
      },
    };

    try {
      // Create draft via Viettel API
      await this.callViettel(
        `/InvoiceAPI/InvoiceWS/createInvoiceDraft/${config.supplierTaxCode}`,
        payload,
      );
    } catch (e: any) {
      this.logger.error(`Lỗi tạo nháp Viettel API: ${e.message}`);
      throw new BadRequestException(
        `Lỗi khi tạo nháp bên Viettel: ${e.message}`,
      );
    }

    try {
      // Sync from Viettel to mirror DB
      const syncResult = await this.syncDraftsFromViettel();
      return {
        ok: true,
        synced: syncResult.synced,
        changed: syncResult.changed,
      };
    } catch (e: any) {
      return {
        ok: true,
        synced: 0,
        changed: false,
        warning: `Tạo nháp thành công nhưng lỗi đồng bộ: ${e.message}. Vui lòng đồng bộ thủ công.`,
      };
    }
  }

  async deleteDraft(id: string) {
    const existing = await this.draftRepo.findOne({ where: { id } });
    if (!existing)
      throw new BadRequestException(`Không tìm thấy hóa đơn nháp id=${id}`);
    await this.draftRepo.remove(existing);
    return { ok: true, id };
  }

  async syncDraftsFromViettel() {
    const config = await this.getConfig();
    if (!config.username || !config.password) {
      throw new BadRequestException(
        'Chưa cấu hình username/password cho SInvoice',
      );
    }

    try {
      // 1. Đăng nhập API nội bộ để lấy token
      const loginRes = await fetch(
        'https://vinvoice.viettel.vn/api/auth/login',
        {
          method: 'POST',
          headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            username: config.username,
            password: config.password,
            rememberMe: true,
            captcha: '',
          }),
        },
      );

      if (!loginRes.ok) {
        throw new BadRequestException(
          'Đăng nhập Viettel thất bại (Web Portal). Có thể bị chặn bởi Captcha hoặc sai mật khẩu.',
        );
      }

      const loginData: any = await loginRes.json();
      const token = loginData.access_token;
      const cluster = loginData.invoice_cluster || 'cluster3';

      if (!token) {
        throw new BadRequestException('Không lấy được access_token từ Viettel');
      }

      // 2. Fetch danh sách nháp
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      let page = 0;
      let allDrafts: any[] = [];

      while (true) {
        const searchUrl =
          `https://vinvoice.viettel.vn/api/${cluster}/services/einvoiceapplication/api/invoice/search-draft-all?page=${page}&size=300&invoiceStatus.equals=0&invoiceTypeId.notEquals=52&sort=id,desc` +
          `&createdDate.greaterThanOrEqual=${encodeURIComponent(thirtyDaysAgo.toISOString())}` +
          `&createdDate.lessThanOrEqual=${encodeURIComponent(now.toISOString())}`;

        const draftRes = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            accept: 'application/json, text/plain, */*',
            authorization: `Bearer ${token}`,
          },
        });

        if (!draftRes.ok) {
          const errText = await draftRes.text();
          this.logger.error(
            `Viettel draft fetch failed: ${draftRes.status} ${draftRes.statusText} - ${errText}`,
          );
          throw new BadRequestException(
            `Lỗi khi tải danh sách nháp từ Viettel: ${draftRes.status} - ${errText}`,
          );
        }

        const rawData: any = await draftRes.json();
        let drafts: any[] = [];

        if (Array.isArray(rawData)) {
          drafts = rawData;
        } else if (
          rawData &&
          rawData.data &&
          Array.isArray(rawData.data.content)
        ) {
          drafts = rawData.data.content;
        } else if (rawData && Array.isArray(rawData.data)) {
          drafts = rawData.data;
        } else if (rawData && Array.isArray(rawData.content)) {
          drafts = rawData.content;
        } else if (rawData && Array.isArray(rawData.items)) {
          drafts = rawData.items;
        } else {
          throw new BadRequestException(
            'Định dạng trả về từ Viettel không hợp lệ: ' +
              JSON.stringify(rawData).substring(0, 200),
          );
        }

        if (drafts.length === 0) {
          break;
        }

        allDrafts.push(...drafts);

        const totalElements =
          rawData?.data?.totalElements || rawData?.totalElements;

        if (totalElements !== undefined) {
          if (allDrafts.length >= totalElements) {
            break;
          }
        } else if (drafts.length < 300) {
          break;
        }

        page++;
      }

      let newDraftEntities: SinvoiceDraft[] = [];

      for (const draft of allDrafts) {
        const vId = draft.id ? String(draft.id) : undefined;
        if (!vId) continue;

        const docNo = `VIETTEL-${vId}`;
        let description = draft.description || draft.listProduct || null;

        // Fetch chi tiết hóa đơn nháp để lấy listProduct
        try {
          await sleep(200); // Delay chống rate-limit
          const detailUrl = `https://vinvoice.viettel.vn/api/${cluster}/services/einvoiceapplication/api/invoice/search-invoice-by-id/${vId}/draft`;
          const detailRes = await fetch(detailUrl, {
            method: 'GET',
            headers: {
              accept: 'application/json, text/plain, */*',
              authorization: `Bearer ${token}`,
            },
          });

          if (detailRes.ok) {
            const detailData: any = await detailRes.json();
            const listProductData =
              detailData?.data?.invoice?.listProduct ||
              detailData?.data?.listProduct ||
              detailData?.listProduct;
            const listProductStr =
              typeof listProductData === 'string'
                ? listProductData
                : JSON.stringify(listProductData);

            if (listProductStr && listProductStr !== 'undefined') {
              draft.listProduct = listProductStr; // Lưu lại vào responsePayload
              try {
                const parsed = JSON.parse(listProductStr);
                if (parsed && Array.isArray(parsed.itemInfo)) {
                  description = parsed.itemInfo
                    .map((i: any) => i.itemName)
                    .filter(Boolean)
                    .join('\\n');
                }
              } catch (e) {
                description = listProductStr;
              }
            }
          }
        } catch (e) {
          this.logger.warn(
            `Lỗi khi lấy chi tiết hóa đơn nháp ${vId}: ${(e as Error).message}`,
          );
        }

        const draftEntity = this.draftRepo.create({
          documentNo: docNo,
          supplierTaxCode: draft.supplierTaxCode || config.supplierTaxCode,
          buyerName:
            draft.buyerUnitName ||
            draft.buyerName ||
            draft.buyerLegalName ||
            'Khách hàng',
          buyerTaxCode: draft.buyerTaxCode || '',
          buyerAddress: draft.buyerAddressLine || draft.buyerAddress || null,
          buyerEmail: draft.buyerEmail || null,
          description,
          totalAmount: String(
            draft.totalAmountWithVAT || draft.totalAmount || draft.total || 0,
          ),
          vatAmount: String(draft.totalVATAmount || draft.taxAmount || 0),
          status: 'DRAFT',
          responsePayload: draft,
          createdAt: draft.createdDate
            ? new Date(draft.createdDate)
            : new Date(),
        });

        newDraftEntities.push(draftEntity);
      }

      // Calculate fingerprints
      const currentDrafts = await this.draftRepo.find({
        where: { documentNo: ILike('VIETTEL-%') },
      });

      const getFingerprint = (list: SinvoiceDraft[]) =>
        JSON.stringify(
          list
            .map(
              (d) =>
                `${d.documentNo}|${d.totalAmount}|${d.buyerName}|${d.description}`,
            )
            .sort(),
        );

      const oldFingerprint = getFingerprint(currentDrafts);
      const newFingerprint = getFingerprint(newDraftEntities);

      if (oldFingerprint === newFingerprint) {
        return {
          ok: true,
          synced: newDraftEntities.length,
          changed: false,
          added: 0,
          removed: 0,
        };
      }

      // Diff
      const oldIds = new Set(currentDrafts.map((d) => d.documentNo));
      const newIds = new Set(newDraftEntities.map((d) => d.documentNo));
      const added = [...newIds].filter((x) => !oldIds.has(x)).length;
      const removed = [...oldIds].filter((x) => !newIds.has(x)).length;

      // Override DB
      await this.draftRepo.delete({ documentNo: ILike('VIETTEL-%') });
      if (newDraftEntities.length > 0) {
        // chunk insert to avoid parameter limit
        for (let i = 0; i < newDraftEntities.length; i += 100) {
          const chunk = newDraftEntities.slice(i, i + 100);
          await this.draftRepo.save(chunk);
        }
      }

      return {
        ok: true,
        synced: newDraftEntities.length,
        changed: true,
        added,
        removed,
      };
    } catch (error: any) {
      this.logger.error('Lỗi syncDraftsFromViettel: ' + error.message);
      throw new BadRequestException(
        error.message || 'Lỗi không xác định khi đồng bộ từ Viettel',
      );
    }
  }

  // ─────────────────────────── HEALTH ─────────────────────────────────────

  async health() {
    let config: any = null;
    try {
      config = await this.getConfig();
    } catch {
      return { ok: false, message: 'Chưa cấu hình SInvoice' };
    }
    return {
      ok: true,
      environment: config.environment ?? 'demo',
      supplierTaxCode: config.supplierTaxCode,
      apiUrl: config.apiUrl,
      username: config.username,
    };
  }

  // ─────────────────────────── VIETTEL API HELPERS ─────────────────────────

  private authHeader(config: any) {
    return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  }

  private async callViettel(endpoint: string, body: any, expectJson = true) {
    const config = await this.getConfig();
    const res = await fetch(`${config.apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(config),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let payload: any = text;
    if (expectJson && text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }
    if (!res.ok) {
      this.logger.error(`Viettel ${endpoint} failed ${res.status}: ${text}`);
      throw new InternalServerErrorException(
        payload?.message ?? payload?.error ?? 'Lỗi khi gọi API Viettel',
      );
    }
    return payload;
  }

  private buildConnectionResult(params: {
    provider: 'SINVOICE' | 'TAX_PORTAL';
    ok: boolean;
    message: string;
    checkedAt?: string;
    detail?: any;
  }) {
    return {
      provider: params.provider,
      ok: params.ok,
      message: params.message,
      checkedAt: params.checkedAt ?? new Date().toISOString(),
      detail: params.detail ?? null,
    };
  }

  private async testSinvoiceConnectionWithConfig(config: any) {
    if (!config?.apiUrl || !config?.username || !config?.password) {
      return this.buildConnectionResult({
        provider: 'SINVOICE',
        ok: false,
        message: 'Thiếu thông tin cấu hình Viettel v2.49 để kiểm tra kết nối',
      });
    }
    try {
      const baseUrl = String(config.apiUrl).replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username: config.username,
          password: config.password,
        }),
      });
      const text = await res.text();
      let detail: any = text;
      try {
        detail = text ? JSON.parse(text) : null;
      } catch {}
      if (!res.ok) {
        return this.buildConnectionResult({
          provider: 'SINVOICE',
          ok: false,
          message: `Kết nối Viettel v2.49 thất bại (${res.status})`,
          detail,
        });
      }
      return this.buildConnectionResult({
        provider: 'SINVOICE',
        ok: true,
        message: 'Đã kết nối thành công tới Viettel v2.49 API',
        detail: { status: res.status, endpoint: `${baseUrl}/auth/login` },
      });
    } catch (error: any) {
      return this.buildConnectionResult({
        provider: 'SINVOICE',
        ok: false,
        message: `Không thể kết nối Viettel v2.49 API: ${error?.message ?? 'Unknown error'}`,
      });
    }
  }

  // ──────────────────────── DOWNLOAD / CANCEL ──────────────────────────────

  async cancelInvoice() {
    throw new BadRequestException(
      'Tính năng hủy/phát hành hóa đơn đang tạm khóa trong draft-only mode.',
    );
  }

  async getInvoiceFile(
    invoiceNo: string,
    pattern: string,
    fileType: FileType = 'PDF',
  ) {
    if (!invoiceNo || !pattern)
      throw new BadRequestException('invoiceNo và pattern là bắt buộc');
    const config = await this.getConfig();
    const payload = {
      commonDataInput: {
        supplierTaxCode: config.supplierTaxCode,
        invoiceNo,
        pattern,
        fileType,
      },
    };
    const endpoint =
      fileType === 'PDF' || fileType === 'ZIP'
        ? '/InvoiceUtilsWS/getInvoiceRepresentationFile'
        : '/InvoiceUtilsWS/getInvoiceFile';
    return this.callViettel(endpoint, payload);
  }

  async fullDemoFlow() {
    throw new BadRequestException(
      'Demo flow đã bị tắt. Hệ thống hiện chỉ cho phép lưu hóa đơn nháp nội bộ.',
    );
  }

  // ──────────────────────── TAX PORTAL (GDT) ───────────────────────────────

  private normalizeTaxPortalConfig(raw: any) {
    return {
      ...raw,
      taxCode: raw.taxCode ?? raw.tax_code,
      providerName: raw.providerName ?? raw.provider_name,
      apiUrl: raw.apiUrl ?? raw.api_url,
      gdtJwt: raw.gdtJwt ?? raw.gdt_jwt,
      gdtCookie: raw.gdtCookie ?? raw.gdt_cookie,
    };
  }

  async getTaxPortalConfig(): Promise<any> {
    // Tax portal config is still stored separately (outside sinvoice scope).
    // Return null — the controller/viettel-v2 handles this separately.
    return null;
  }

  async saveTaxPortalConfig(_dto: any) {
    throw new BadRequestException(
      'Cấu hình Tax Portal được quản lý qua module riêng.',
    );
  }

  async resetTaxPortalConfig() {
    throw new BadRequestException(
      'Cấu hình Tax Portal được quản lý qua module riêng.',
    );
  }

  async syncTaxPortal(_query: TaxPortalSyncQueryDto = {}) {
    throw new BadRequestException(
      'Đồng bộ Tax Portal được thực hiện qua module riêng.',
    );
  }
}
