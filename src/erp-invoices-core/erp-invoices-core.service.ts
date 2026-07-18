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
import { normalizeInvoiceNo } from './utils/normalize-invoice-no';
import AdmZip from 'adm-zip';
import * as ExcelJS from 'exceljs';
import { BankTransactionsCoreService } from '../bank-transactions-core/bank-transactions-core.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountingCoreService } from '../accounting-core/services/accounting-core.service';
import { PostInvoiceDto } from './dto/post-invoice.dto';

export interface ErpInvoiceQuery {
  direction?: string;
  search?: string;
  seller_name?: string;
  buyer_name?: string;
  partner_tax_code?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  tag_id?: string;
  page?: number;
  pageSize?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  export_type?: 'summary' | 'detailed';
  column_search?: string;
  column_filters?: string;
  is_valid?: string;
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
    private readonly notificationsService: NotificationsService,
    private readonly accountingCoreService: AccountingCoreService,
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

  async getColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    direction?: 'IN' | 'OUT',
  ) {
    const qb = this.repository.createQueryBuilder('inv');

    if (direction) {
      qb.where('inv.direction = :direction', { direction });
    } else {
      qb.where('1 = 1');
    }

    let selectField = '';
    let isDateColumn = false;
    if (column === 'invoiceDate') {
      selectField = "TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')";
      isDateColumn = true;
    } else if (column === 'serialNo') selectField = 'inv.serial_no';
    else if (column === 'invoiceNo') selectField = 'inv.invoice_no';
    else if (column === 'partner') {
      if (direction === 'IN') selectField = 'inv.seller_name';
      else if (direction === 'OUT') selectField = 'inv.buyer_name';
      else selectField = 'COALESCE(inv.seller_name, inv.buyer_name)'; // fallback
    } else if (column === 'taxCode') {
      if (direction === 'IN') selectField = 'inv.seller_tax_code';
      else if (direction === 'OUT') selectField = 'inv.buyer_tax_code';
      else selectField = 'COALESCE(inv.seller_tax_code, inv.buyer_tax_code)';
    } else if (column === 'description') selectField = 'inv.description';
    else if (column === 'preVatAmount') selectField = 'inv.pre_vat_amount';
    else if (column === 'vatAmount') selectField = 'inv.vat_amount';
    else if (column === 'discountAmount') selectField = 'inv.discount_amount';
    else if (column === 'totalAmount') selectField = 'inv.total_amount';
    else if (column === 'licensePlate') selectField = 'inv.license_plate';
    else if (column === 'settlementOrder') selectField = 'inv.settlement_order';
    else if (column === 'branchId') selectField = 'inv.branch_id';
    else return { items: [], total: 0, page, pageSize, totalPages: 0 };

    qb.select(`DISTINCT ${selectField}`, 'value');
    if (isDateColumn) {
      qb.andWhere('inv.invoice_date IS NOT NULL');
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
          if (col === 'invoiceDate')
            filterField = `TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')`;
          else if (col === 'serialNo') filterField = 'inv.serial_no';
          else if (col === 'invoiceNo') filterField = 'inv.invoice_no';
          else if (col === 'partner') {
            if (direction === 'IN') filterField = 'inv.seller_name';
            else if (direction === 'OUT') filterField = 'inv.buyer_name';
            else filterField = 'COALESCE(inv.seller_name, inv.buyer_name)';
          } else if (col === 'taxCode') {
            if (direction === 'IN') filterField = 'inv.seller_tax_code';
            else if (direction === 'OUT') filterField = 'inv.buyer_tax_code';
            else
              filterField = 'COALESCE(inv.seller_tax_code, inv.buyer_tax_code)';
          } else if (col === 'description') filterField = 'inv.description';
          else if (col === 'preVatAmount') filterField = 'inv.pre_vat_amount';
          else if (col === 'vatAmount') filterField = 'inv.vat_amount';
          else if (col === 'discountAmount')
            filterField = 'inv.discount_amount';
          else if (col === 'totalAmount') filterField = 'inv.total_amount';
          else if (col === 'licensePlate') filterField = 'inv.license_plate';
          else if (col === 'settlementOrder')
            filterField = 'inv.settlement_order';
          else if (col === 'branchId') filterField = 'inv.branch_id';

          if (filterField) {
            qb.andWhere(`CAST(${filterField} AS TEXT) IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          }
        }
      } catch (e) {}
    }

    if (search) {
      qb.andWhere(`CAST(${selectField} AS TEXT) ILIKE :search`, {
        search: `%${search}%`,
      });
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

    return {
      items: results.map((r) => String(r.value)).filter(Boolean),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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

    let orderColumn = 'inv.invoiceDate';
    let orderProperty = 'invoiceDate';
    let orderDirection: 'ASC' | 'DESC' = 'DESC';

    if (query.sort_by) {
      if (query.sort_by === 'invoiceNo') {
        orderColumn = 'inv.invoiceNo';
        orderProperty = 'invoiceNo';
      } else if (query.sort_by === 'totalAmount') {
        orderColumn = 'inv.totalAmount';
        orderProperty = 'totalAmount';
      } else if (query.sort_by === 'sellerName') {
        orderColumn = 'inv.sellerName';
        orderProperty = 'sellerName';
      } else if (query.sort_by === 'buyerName') {
        orderColumn = 'inv.buyerName';
        orderProperty = 'buyerName';
      } else if (query.sort_by === 'status') {
        orderColumn = 'inv.status';
        orderProperty = 'status';
      } else if (query.sort_by === 'invoiceDate') {
        orderColumn = 'inv.invoiceDate';
        orderProperty = 'invoiceDate';
      } else if (query.sort_by === 'serialNo') {
        orderColumn = 'inv.serialNo';
        orderProperty = 'serialNo';
      } else if (query.sort_by === 'partner') {
        if (query.direction === 'IN') {
          orderColumn = 'inv.sellerName';
          orderProperty = 'sellerName';
        } else {
          orderColumn = 'inv.buyerName';
          orderProperty = 'buyerName';
        }
      } else if (query.sort_by === 'taxCode') {
        if (query.direction === 'IN') {
          orderColumn = 'inv.sellerTaxCode';
          orderProperty = 'sellerTaxCode';
        } else {
          orderColumn = 'inv.buyerTaxCode';
          orderProperty = 'buyerTaxCode';
        }
      } else if (query.sort_by === 'description') {
        orderColumn = 'inv.description';
        orderProperty = 'description';
      } else if (query.sort_by === 'preVatAmount') {
        orderColumn = 'inv.preVatAmount';
        orderProperty = 'preVatAmount';
      } else if (query.sort_by === 'vatAmount') {
        orderColumn = 'inv.vatAmount';
        orderProperty = 'vatAmount';
      } else if (query.sort_by === 'discountAmount') {
        orderColumn = 'inv.discountAmount';
        orderProperty = 'discountAmount';
      } else if (query.sort_by === 'licensePlate') {
        orderColumn = 'inv.licensePlate';
        orderProperty = 'licensePlate';
      } else if (query.sort_by === 'settlementOrder') {
        orderColumn = 'inv.settlementOrder';
        orderProperty = 'settlementOrder';
      } else if (query.sort_by === 'branchId') {
        orderColumn = 'inv.branchId';
        orderProperty = 'branchId';
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
    if (query.is_valid) {
      where.isValid = query.is_valid === 'true' || query.is_valid === '1';
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

    let columnSearch: Record<string, string> = {};
    let columnFilters: Record<string, string[]> = {};
    try {
      if (query.column_search) columnSearch = JSON.parse(query.column_search);
      if (query.column_filters)
        columnFilters = JSON.parse(query.column_filters);
    } catch (e) {
      this.logger.error('Failed to parse column_search or column_filters', e);
    }

    // Search / explicit seller/buyer name filters via QueryBuilder
    const needsQb = !!(
      query.search ||
      query.seller_name ||
      query.buyer_name ||
      query.partner_tax_code ||
      query.tag_id ||
      query.sort_by === 'invoiceNo' ||
      Object.keys(columnSearch).length > 0 ||
      Object.keys(columnFilters).length > 0
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
        .andWhere(query.is_valid ? 'inv.is_valid = :isValid' : '1=1', {
          isValid: query.is_valid === 'true' || query.is_valid === '1',
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
      if (query.partner_tax_code) {
        qb.andWhere(
          '(inv.seller_tax_code = :ptc OR inv.buyer_tax_code = :ptc)',
          {
            ptc: query.partner_tax_code,
          },
        );
      }
      if (query.tag_id) {
        qb.andWhere(
          `inv.id IN (SELECT entity_id FROM sys_entity_tags WHERE entity_type = 'erp_invoice' AND tag_id = :tagId)`,
          { tagId: query.tag_id },
        );
      }

      // -------------------------------------------------------------
      // Dynamic Column Search
      // -------------------------------------------------------------
      Object.keys(columnSearch).forEach((key) => {
        const val = columnSearch[key];
        if (!val) return;

        if (key === 'invoiceNo') {
          qb.andWhere('inv.invoice_no ILIKE :invoiceNoSearch', {
            invoiceNoSearch: `%${val}%`,
          });
        } else if (key === 'serialNo') {
          qb.andWhere('inv.serial_no ILIKE :serialNoSearch', {
            serialNoSearch: `%${val}%`,
          });
        } else if (key === 'partner') {
          if (query.direction === 'IN') {
            qb.andWhere('inv.seller_name ILIKE :partnerSearch', {
              partnerSearch: `%${val}%`,
            });
          } else if (query.direction === 'OUT') {
            qb.andWhere('inv.buyer_name ILIKE :partnerSearch', {
              partnerSearch: `%${val}%`,
            });
          } else {
            qb.andWhere(
              '(inv.seller_name ILIKE :partnerSearch OR inv.buyer_name ILIKE :partnerSearch)',
              { partnerSearch: `%${val}%` },
            );
          }
        } else if (key === 'taxCode') {
          if (query.direction === 'IN') {
            qb.andWhere('inv.seller_tax_code ILIKE :taxCodeSearch', {
              taxCodeSearch: `%${val}%`,
            });
          } else if (query.direction === 'OUT') {
            qb.andWhere('inv.buyer_tax_code ILIKE :taxCodeSearch', {
              taxCodeSearch: `%${val}%`,
            });
          } else {
            qb.andWhere(
              '(inv.seller_tax_code ILIKE :taxCodeSearch OR inv.buyer_tax_code ILIKE :taxCodeSearch)',
              { taxCodeSearch: `%${val}%` },
            );
          }
        } else if (key === 'description') {
          qb.andWhere('inv.description ILIKE :descSearch', {
            descSearch: `%${val}%`,
          });
        } else if (key === 'preVatAmount') {
          qb.andWhere(
            "REPLACE(REPLACE(CAST(inv.pre_vat_amount AS TEXT), '.', ''), ',', '') ILIKE :preVatSearch",
            { preVatSearch: `%${val}%` },
          );
        } else if (key === 'vatAmount') {
          qb.andWhere(
            "REPLACE(REPLACE(CAST(inv.vat_amount AS TEXT), '.', ''), ',', '') ILIKE :vatSearch",
            { vatSearch: `%${val}%` },
          );
        } else if (key === 'discountAmount') {
          qb.andWhere(
            "REPLACE(REPLACE(CAST(inv.discount_amount AS TEXT), '.', ''), ',', '') ILIKE :discountSearch",
            { discountSearch: `%${val}%` },
          );
        } else if (key === 'totalAmount') {
          qb.andWhere(
            "REPLACE(REPLACE(CAST(inv.total_amount AS TEXT), '.', ''), ',', '') ILIKE :totalSearch",
            { totalSearch: `%${val}%` },
          );
        } else if (key === 'settlementOrder') {
          qb.andWhere('inv.settlement_order ILIKE :settlementSearch', {
            settlementSearch: `%${val}%`,
          });
        } else if (key === 'licensePlate') {
          qb.andWhere('inv.license_plate ILIKE :plateSearch', {
            plateSearch: `%${val}%`,
          });
        }
      });

      // -------------------------------------------------------------
      // Dynamic Column Filters
      // -------------------------------------------------------------
      Object.keys(columnFilters).forEach((key) => {
        const vals = columnFilters[key];
        if (!vals || vals.length === 0) return;

        if (key === 'status') {
          qb.andWhere('inv.status IN (:...statusVals)', { statusVals: vals });
        } else if (key === 'postingStatus') {
          qb.andWhere('inv.posting_status IN (:...postingStatusVals)', {
            postingStatusVals: vals,
          });
        } else if (key === 'branchId') {
          qb.andWhere('inv.branch_id IN (:...branchVals)', {
            branchVals: vals,
          });
        } else if (key === 'invoiceDate') {
          qb.andWhere(
            `TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') IN (:...invoiceDateVals)`,
            { invoiceDateVals: vals },
          );
        } else if (key === 'serialNo') {
          qb.andWhere('inv.serial_no IN (:...serialNoVals)', {
            serialNoVals: vals,
          });
        } else if (key === 'invoiceNo') {
          qb.andWhere('inv.invoice_no IN (:...invoiceNoVals)', {
            invoiceNoVals: vals,
          });
        } else if (key === 'partner') {
          if (query.direction === 'IN') {
            qb.andWhere('inv.seller_name IN (:...partnerVals)', {
              partnerVals: vals,
            });
          } else if (query.direction === 'OUT') {
            qb.andWhere('inv.buyer_name IN (:...partnerVals)', {
              partnerVals: vals,
            });
          } else {
            qb.andWhere(
              'COALESCE(inv.seller_name, inv.buyer_name) IN (:...partnerVals)',
              { partnerVals: vals },
            );
          }
        } else if (key === 'taxCode') {
          if (query.direction === 'IN') {
            qb.andWhere('inv.seller_tax_code IN (:...taxCodeVals)', {
              taxCodeVals: vals,
            });
          } else if (query.direction === 'OUT') {
            qb.andWhere('inv.buyer_tax_code IN (:...taxCodeVals)', {
              taxCodeVals: vals,
            });
          } else {
            qb.andWhere(
              'COALESCE(inv.seller_tax_code, inv.buyer_tax_code) IN (:...taxCodeVals)',
              { taxCodeVals: vals },
            );
          }
        } else if (key === 'description') {
          qb.andWhere('inv.description IN (:...descVals)', { descVals: vals });
        } else if (key === 'isValid') {
          const validFilter = vals.includes('true') || vals.includes('1');
          const invalidFilter = vals.includes('false') || vals.includes('0');
          if (validFilter && !invalidFilter) {
            qb.andWhere('inv.is_valid = true');
          } else if (invalidFilter && !validFilter) {
            qb.andWhere('inv.is_valid = false');
          }
        } else if (key === 'preVatAmount') {
          qb.andWhere('CAST(inv.pre_vat_amount AS TEXT) IN (:...preVatVals)', {
            preVatVals: vals,
          });
        } else if (key === 'vatAmount') {
          qb.andWhere('CAST(inv.vat_amount AS TEXT) IN (:...vatVals)', {
            vatVals: vals,
          });
        } else if (key === 'discountAmount') {
          qb.andWhere(
            'CAST(inv.discount_amount AS TEXT) IN (:...discountVals)',
            { discountVals: vals },
          );
        } else if (key === 'totalAmount') {
          qb.andWhere('CAST(inv.total_amount AS TEXT) IN (:...totalVals)', {
            totalVals: vals,
          });
        } else if (key === 'settlementOrder') {
          qb.andWhere('inv.settlement_order IN (:...settleVals)', {
            settleVals: vals,
          });
        } else if (key === 'licensePlate') {
          qb.andWhere('inv.license_plate IN (:...plateVals)', {
            plateVals: vals,
          });
        } else if (key === 'attachments') {
          const conditions: string[] = [];
          if (vals.includes('has_pdf')) {
            conditions.push(
              "(inv.pdf_file_key IS NOT NULL OR (inv.pdf_files IS NOT NULL AND inv.pdf_files::text != '[]' AND inv.pdf_files::text != 'null'))",
            );
          }
          if (vals.includes('has_xml')) {
            conditions.push('inv.xml_file_key IS NOT NULL');
          }
          if (vals.includes('no_pdf')) {
            conditions.push(
              "(inv.pdf_file_key IS NULL AND (inv.pdf_files IS NULL OR inv.pdf_files::text = '[]' OR inv.pdf_files::text = 'null'))",
            );
          }
          if (vals.includes('no_xml')) {
            conditions.push('inv.xml_file_key IS NULL');
          }
          if (conditions.length > 0) {
            qb.andWhere(`(${conditions.join(' OR ')})`);
          }
        } else if (key === 'taxInvoiceType') {
          qb.andWhere('inv.tax_invoice_type IN (:...taxInvoiceTypeVals)', {
            taxInvoiceTypeVals: vals,
          });
        } else if (key === 'taxInvoiceStatus') {
          qb.andWhere('inv.tax_invoice_status IN (:...taxInvoiceStatusVals)', {
            taxInvoiceStatusVals: vals
              .map((v) => parseInt(v, 10))
              .filter((v) => !isNaN(v)),
          });
        } else if (key === 'taxProcessStatus') {
          qb.andWhere('inv.tax_process_status IN (:...taxProcessStatusVals)', {
            taxProcessStatusVals: vals
              .map((v) => parseInt(v, 10))
              .filter((v) => !isNaN(v)),
          });
        }
      });

      let qbOrderColumn = orderColumn;
      if (query.sort_by === 'invoiceNo') {
        qbOrderColumn =
          "NULLIF(regexp_replace(inv.invoice_no, '\\\\D', '', 'g'), '')::numeric";
      }

      let qbOrdered = qb.orderBy(qbOrderColumn, orderDirection);
      if (query.sort_by === 'invoiceNo') {
        qbOrdered = qbOrdered.addOrderBy('inv.invoiceNo', orderDirection);
      }

      const searchResults = await qbOrdered
        .leftJoinAndSelect('inv.items', 'items')
        .addOrderBy('inv.createdAt', 'DESC')
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
      relations: ['items'],
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

  async bulkSetBranch(ids: string[], branchId: string | null) {
    if (!ids || !ids.length) {
      return { updated: 0, ids: [] };
    }

    // Lọc ra các hóa đơn hợp lệ (chưa bị xóa)
    const existingInvoices = await this.repository.find({
      where: { id: In(ids), isDeleted: false },
      select: ['id'],
    });

    const validIds = existingInvoices.map((inv) => inv.id);
    if (validIds.length === 0) {
      return { updated: 0, ids: [] };
    }

    // Bulk update branchId
    await this.repository.update({ id: In(validIds) }, { branchId });

    // Sync branch to journal entries for POSTED invoices
    const postedInvoices = await this.repository.find({
      where: { id: In(validIds), postingStatus: 'POSTED', isDeleted: false },
      select: ['id'],
    });

    if (postedInvoices.length > 0 && branchId) {
      Promise.all(
        postedInvoices.map((inv) =>
          this.accountingCoreService
            .updateJournalEntryBranch(inv.id, 'INVOICE', branchId)
            .catch((e) =>
              this.logger.warn(
                `UC2 bulk branch sync failed for ${inv.id}: ${e.message}`,
              ),
            ),
        ),
      ).catch(() => {});
    }

    return { updated: validIds.length, ids: validIds };
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

    // Capture before merge for branch sync
    const oldBranchId = existing.branchId;
    const wasPosted = existing.postingStatus === 'POSTED';

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

    // Sync journal entry branch if changed
    if (
      wasPosted &&
      dto.branchId !== undefined &&
      dto.branchId !== oldBranchId &&
      dto.branchId
    ) {
      this.accountingCoreService
        .updateJournalEntryBranch(id, 'INVOICE', dto.branchId)
        .catch((e) =>
          this.logger.warn(`UC2 branch sync failed for ${id}: ${e.message}`),
        );
    }

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
  async syncFromPortal(dto: PortalFetchDto, userId?: string) {
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
    const queryConfigs =
      type === 'purchase'
        ? [
            {
              basePath:
                'https://hoadondientu.gdt.gov.vn/api/query/invoices/purchase',
              ttxlyList: [5, 6],
              invoiceType: 'STANDARD',
            },
            {
              basePath:
                'https://hoadondientu.gdt.gov.vn/api/sco-query/invoices/purchase',
              ttxlyList: [8],
              invoiceType: 'CASH_REGISTER',
            },
          ]
        : [
            {
              basePath:
                'https://hoadondientu.gdt.gov.vn/api/query/invoices/sold',
              ttxlyList: [],
              invoiceType: 'STANDARD',
            },
          ];

    const [fromY, fromM, fromD] = dto.dateFrom.split('-').map(Number);
    const startDate = new Date(fromY, fromM - 1, fromD);
    const [toY, toM, toD] = dto.dateTo.split('-').map(Number);
    const endDate = new Date(toY, toM - 1, toD);

    // Run the sync process in the background
    (async () => {
      try {
        const rawItems: any[] = [];
        let totalFromPortal = 0;
        let pagesFetched = 0;
        const maxPages = 50; // max pages per endpoint
        let isFirstRequest = true;

        for (
          let d = new Date(startDate);
          d <= endDate;
          d.setDate(d.getDate() + 1)
        ) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const formattedDate = `${day}/${m}/${y}`;

          for (const config of queryConfigs) {
            const loopTtxlys =
              config.ttxlyList.length > 0 ? config.ttxlyList : [null];

            for (const currentTtxly of loopTtxlys) {
              let state: string | null = null;
              let pathPagesFetched = 0;

              do {
                const url = new URL(config.basePath);
                url.searchParams.set('sort', 'tdlap:desc');
                url.searchParams.set('size', '50');

                let searchStr = `tdlap=ge=${formattedDate}T00:00:00;tdlap=le=${formattedDate}T23:59:59`;
                if (currentTtxly !== null) {
                  searchStr += `;ttxly==${currentTtxly}`;
                }
                url.searchParams.set('search', searchStr);

                if (state) {
                  url.searchParams.set('state', state);
                }

                this.progress$.next({
                  processId: 'sync-progress',
                  type: 'bulk',
                  total: 100, // Unknown total pages initially
                  current: pagesFetched,
                  message: `Đang lấy danh sách hóa đơn từ cơ quan thuế (ngày ${formattedDate}, trang ${pagesFetched + 1})...`,
                  completed: false,
                });

                if (!isFirstRequest) {
                  const delay = (4 + Math.random() * 3) * 1000;
                  await this.sleep(Math.round(delay));
                }
                isFirstRequest = false;

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
                  const mappedDatas = payload.datas.map((d: any) => ({
                    ...d,
                    __taxInvoiceType: config.invoiceType,
                  }));
                  rawItems.push(...mappedDatas);
                }

                state = payload.state ?? null;
                pathPagesFetched++;
                pagesFetched++;
              } while (state && pathPagesFetched < maxPages);
            }
          }
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

            const taxInvoiceStatus =
              raw.tthai !== undefined && raw.tthai !== null
                ? Number(raw.tthai)
                : null;
            const taxProcessStatus =
              raw.ttxly !== undefined && raw.ttxly !== null
                ? Number(raw.ttxly)
                : null;
            const taxInvoiceType = raw.__taxInvoiceType || 'STANDARD';

            const existing = await this.repository.findOne({
              where: { invoiceNo, serialNo, direction, isDeleted: false },
            });
            if (existing) {
              let updated = false;
              if (existing.taxInvoiceStatus !== taxInvoiceStatus) {
                existing.taxInvoiceStatus = taxInvoiceStatus;
                updated = true;
              }
              if (existing.taxProcessStatus !== taxProcessStatus) {
                existing.taxProcessStatus = taxProcessStatus;
                updated = true;
              }
              if (existing.taxInvoiceType !== taxInvoiceType) {
                existing.taxInvoiceType = taxInvoiceType;
                updated = true;
              }

              if (updated) {
                await this.repository.save(existing);
              }

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
              status: [4, 6].includes(Number(raw.tthai))
                ? 'CANCELLED'
                : 'CONFIRMED',
              taxInvoiceStatus,
              taxProcessStatus,
              taxInvoiceType,
              sellerTaxCode: raw.nbmst ?? null,
              sellerName: raw.nbten ?? null,
              sellerAddress: raw.nbdchi ?? null,
              buyerTaxCode: raw.nmmst ?? raw.mst ?? null,
              buyerName: raw.nmten ?? null,
              buyerAddress: raw.nmdchi ?? null,
              buyerPersonalName: raw.nmtnmua ?? null,
              buyerCccd: raw.nmcmnd ?? null,
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
        if (userId) {
          await this.notificationsService.createForUser(userId, {
            title: 'Lỗi đồng bộ hóa đơn',
            message: `Tiến trình đồng bộ hóa đơn bị lỗi: ${(err as Error).message}`,
            type: 'ERROR',
          });
        }
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

    for (let i = 0; i < targets.length; i++) {
      const inv = targets[i];
      await this.downloadAndSaveXml(inv, token).catch((e) =>
        this.logger.error(`Error downloading XML for ${inv.invoiceNo}:`, e),
      );

      current++;
      this.progress$.next({
        processId,
        type: 'sync',
        total,
        current,
        message: `Đang tải chi tiết & XML (${current}/${total})...`,
        completed: false,
      });

      // Bắt buộc chờ 4-7s giữa MỖI hóa đơn để tránh 429
      if (i + 1 < targets.length) {
        const delay = (4 + Math.random() * 3) * 1000;
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

    // 2. Nghỉ 2s trước khi tải XML để tránh dồn dập
    await this.sleep(2000);

    // 3. Tải XML để làm chứng từ (nếu lỗi thì bỏ qua)
    try {
      let endpoints: string[] = [];
      if (invoice.taxInvoiceType === 'CASH_REGISTER') {
        endpoints = ['sco-query'];
      } else if (invoice.taxInvoiceType === 'STANDARD') {
        endpoints = ['query'];
      } else {
        endpoints = ['query', 'sco-query'];
      }

      let res: Response | null = null;
      for (let i = 0; i < endpoints.length; i++) {
        const ep = endpoints[i];
        const xmlUrl = new URL(
          `https://hoadondientu.gdt.gov.vn/api/${ep}/invoices/export-xml`,
        );
        xmlUrl.searchParams.set('nbmst', invoice.sellerTaxCode ?? '');
        xmlUrl.searchParams.set('khhdon', invoice.serialNo ?? '');
        xmlUrl.searchParams.set('shdon', invoice.invoiceNo);
        xmlUrl.searchParams.set('khmshdon', '1');

        res = await this.fetchWithRetry(
          xmlUrl.toString(),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
          i === endpoints.length - 1 ? 2 : 0,
        );

        if (res.ok) break;
      }

      if (!res || !res.ok) {
        this.logger.warn(
          `XML download failed for invoice ${invoice.invoiceNo}: HTTP ${res?.status ?? 'Unknown'}`,
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
        buyerPersonalName: parsedXml.buyerPersonalName ?? undefined,
        buyerCccd: parsedXml.buyerCccd ?? undefined,
        buyerTaxCode: parsedXml.buyerTaxCode ?? undefined,
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
      let endpoints: string[] = [];
      if (invoice.taxInvoiceType === 'CASH_REGISTER') {
        endpoints = ['sco-query'];
      } else if (invoice.taxInvoiceType === 'STANDARD') {
        endpoints = ['query'];
      } else {
        endpoints = ['query', 'sco-query'];
      }

      let res: Response | null = null;
      for (let i = 0; i < endpoints.length; i++) {
        const ep = endpoints[i];
        const url = new URL(
          `https://hoadondientu.gdt.gov.vn/api/${ep}/invoices/detail`,
        );
        url.searchParams.set('nbmst', invoice.sellerTaxCode ?? '');
        url.searchParams.set('khhdon', invoice.serialNo ?? '');
        url.searchParams.set('shdon', invoice.invoiceNo);
        url.searchParams.set('khmshdon', '1');

        res = await this.fetchWithRetry(
          url.toString(),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
          i === endpoints.length - 1 ? 2 : 0,
        );

        if (res.ok) break;
      }

      if (!res || !res.ok) {
        this.logger.warn(
          `Failed to fetch JSON detail for ${invoice.invoiceNo}: HTTP ${res?.status ?? 'Unknown'}`,
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
        buyerPersonalName: json.nmtnmua,
        buyerCccd: json.nmcmnd,
        buyerTaxCode: json.mst,
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
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const res = await fetch(url, {
          ...options,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            ...(options?.headers || {}),
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          return res;
        }

        if (res.status === 401 || res.status === 403) {
          throw new Error('GDT_TOKEN_EXPIRED');
        }

        if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
          if (i < retries) {
            this.logger.warn(
              `GDT API rate limit or server error (${res.status}) on ${url}, retrying ${i + 1}/${retries}...`,
            );
            const delay = res.status === 429 ? 5000 * (i + 1) : 1000 * (i + 1);
            await this.sleep(delay);
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

  async setInvoiceValid(
    id: string,
    isValid: boolean,
    userId: string,
  ): Promise<void> {
    const invoice = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (isValid) {
      invoice.isValid = true;
      invoice.validatedAt = new Date();
      invoice.validatedBy = userId;
    } else {
      invoice.isValid = false;
      invoice.validatedAt = null;
      invoice.validatedBy = null;
    }

    await this.repository.save(invoice);
  }

  async checkTokenValid(token: string): Promise<boolean> {
    if (!token) return false;
    try {
      const url =
        'https://hoadondientu.gdt.gov.vn/api/query/invoices/purchase?sort=tdlap%3Adesc&size=1';
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      return res.status === 200;
    } catch (e) {
      return false;
    }
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

        // 2. Kiểm tra duplicate: invoiceNoNormalized + seller_tax_code
        const invoiceNoNorm = normalizeInvoiceNo(parsed.invoiceNo);
        const existing = await this.repository.findOne({
          where: {
            invoiceNoNormalized: invoiceNoNorm || undefined,
            sellerTaxCode: parsed.sellerTaxCode ?? undefined,
          } as any, // Typecast to any to avoid TypeORM type inference issues
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
          invoiceNoNormalized: invoiceNoNorm || undefined,
          serialNo: parsed.serialNo,
          invoiceDate: parsed.invoiceDate,
          direction,
          status: 'CONFIRMED',
          sellerName: parsed.sellerName,
          sellerTaxCode: parsed.sellerTaxCode,
          sellerAddress: parsed.sellerAddress,
          sellerBank: parsed.sellerBank,
          buyerName: parsed.buyerName,
          buyerPersonalName: parsed.buyerPersonalName,
          buyerCccd: parsed.buyerCccd,
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

  async bulkImportMixed(
    files: Array<{ filename: string; buffer: Buffer; mimetype: string }>,
    direction: 'IN' | 'OUT',
  ): Promise<BulkImportResult> {
    const importId = crypto.randomUUID();
    const skipped: BulkImportSkippedItem[] = [];
    const errors: BulkImportErrorItem[] = [];
    let created = 0;
    const pdfAttached: any[] = [];
    const pdfOrphans: any[] = [];

    // 1. Phân loại files & Giải nén ZIP
    const xmlEntries: { filename: string; buffer: Buffer }[] = [];
    const pdfEntries: { filename: string; buffer: Buffer; mimetype: string }[] =
      [];

    for (const f of files) {
      const lowerName = f.filename.toLowerCase();
      if (lowerName.endsWith('.zip') || f.mimetype === 'application/zip') {
        try {
          const zip = new AdmZip(f.buffer);
          const zipEntries = zip.getEntries();
          for (const entry of zipEntries) {
            if (entry.isDirectory) continue;
            const entryName = entry.entryName;
            const ext = entryName.split('.').pop()?.toLowerCase();
            if (ext === 'xml') {
              xmlEntries.push({ filename: entryName, buffer: entry.getData() });
            } else if (ext === 'pdf') {
              pdfEntries.push({
                filename: entryName,
                buffer: entry.getData(),
                mimetype: 'application/pdf',
              });
            }
          }
        } catch (e) {
          errors.push({
            filename: f.filename,
            reason: `Không thể giải nén file ZIP: ${(e as Error).message}`,
          });
        }
      } else if (
        lowerName.endsWith('.xml') ||
        f.mimetype === 'application/xml' ||
        f.mimetype === 'text/xml'
      ) {
        xmlEntries.push(f);
      } else if (
        lowerName.endsWith('.pdf') ||
        f.mimetype === 'application/pdf'
      ) {
        pdfEntries.push(f);
      } else {
        // Skip unknown files
      }
    }

    // 2. Build Map cho PDF theo basename
    // basename: "Inv001" từ "Inv001.pdf"
    const pdfMap = new Map<
      string,
      { filename: string; buffer: Buffer; mimetype: string }
    >();
    for (const p of pdfEntries) {
      const basename = p.filename
        .substring(0, p.filename.lastIndexOf('.'))
        .toLowerCase();
      pdfMap.set(basename, p);
    }

    // 3. Xử lý XML
    for (const file of xmlEntries) {
      try {
        const parsed = parseVietnamInvoiceXml(file.buffer.toString('utf-8'));
        const invoiceNoNorm = normalizeInvoiceNo(parsed.invoiceNo);

        let existingInvoice = await this.repository.findOne({
          where: {
            invoiceNoNormalized: invoiceNoNorm || undefined,
            sellerTaxCode: parsed.sellerTaxCode ?? undefined,
            direction,
          } as any,
        });

        const basename = file.filename
          .substring(0, file.filename.lastIndexOf('.'))
          .toLowerCase();
        const matchedPdf = pdfMap.get(basename);

        if (existingInvoice) {
          skipped.push({
            filename: file.filename,
            invoiceNo: parsed.invoiceNo,
            sellerName: parsed.sellerName,
            sellerTaxCode: parsed.sellerTaxCode,
            reason: 'DUPLICATE',
          });

          // Dù duplicate XML, nếu có PDF đi kèm và hóa đơn chưa có PDF này, attach nó vào (optional)
          // Ở đây ta xoá PDF khỏi map để không đưa vào orphan
          if (matchedPdf) {
            pdfMap.delete(basename);
          }
          continue;
        }

        // Upload XML
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
        let xmlUploaded = false;
        try {
          await this.r2.uploadBuffer(xmlKey, file.buffer, 'application/xml');
          xmlUploaded = true;
        } catch (r2Err) {
          this.logger.warn(
            `R2 upload failed for ${file.filename}: ${(r2Err as Error).message}`,
          );
        }

        // Tạo record
        let notes = '';
        if (parsed.lookupCode || parsed.providerLink) {
          notes = `[Lookup Info] Code: ${parsed.lookupCode ?? 'N/A'} - Link: ${parsed.providerLink ?? 'N/A'}`;
        }

        const newInvoiceData: any = {
          invoiceNo: parsed.invoiceNo,
          invoiceNoNormalized: invoiceNoNorm || undefined,
          serialNo: parsed.serialNo,
          invoiceDate: parsed.invoiceDate,
          direction,
          status: 'CONFIRMED',
          sellerName: parsed.sellerName,
          sellerTaxCode: parsed.sellerTaxCode,
          sellerAddress: parsed.sellerAddress,
          sellerBank: parsed.sellerBank,
          buyerName: parsed.buyerName,
          buyerPersonalName: parsed.buyerPersonalName,
          buyerCccd: parsed.buyerCccd,
          buyerTaxCode: parsed.buyerTaxCode,
          buyerAddress: parsed.buyerAddress,
          description: parsed.description,
          notes: notes || undefined,
          preVatAmount: String(parsed.preVatAmount),
          vatRate: parsed.vatRate != null ? String(parsed.vatRate) : null,
          vatAmount: String(parsed.vatAmount),
          discountAmount: String(parsed.discountAmount),
          totalAmount: String(parsed.totalAmount),
          xmlFileKey: xmlUploaded ? xmlKey : null,
          xmlImportId: importId,
          pdfFiles: [],
        };
        const newInvoice = this.repository.create(
          newInvoiceData,
        ) as any as ErpInvoice;

        this.extractInvoiceMetadata(newInvoice);

        // Xử lý PDF đi kèm XML
        if (matchedPdf) {
          pdfMap.delete(basename); // Remove from orphans

          const ts = Date.now();
          const safePdfName = matchedPdf.filename.replace(/[^\w.-]/g, '_');
          const pdfKey = `invoices/${direction}/${yyyy}/${mm}/${safeNo}_${ts}_0_${safePdfName}`;
          try {
            await this.r2.uploadBuffer(
              pdfKey,
              matchedPdf.buffer,
              matchedPdf.mimetype || 'application/pdf',
            );
            newInvoice.pdfFileKey = pdfKey;
            newInvoice.pdfFiles = [
              {
                key: pdfKey,
                filename: matchedPdf.filename,
                uploadedAt: new Date().toISOString(),
              },
            ];
            pdfAttached.push({
              filename: matchedPdf.filename,
              invoiceNo: newInvoice.invoiceNo,
            });
          } catch (r2Err) {
            this.logger.warn(`R2 PDF upload failed for ${matchedPdf.filename}`);
          }
        }

        await this.repository.save(newInvoice);
        created++;
      } catch (err) {
        const reason =
          err instanceof XmlParseError
            ? err.message
            : `Lỗi hệ thống: ${(err as Error).message}`;
        errors.push({ filename: file.filename, reason });
      }
    }

    // 4. Xử lý Orphans PDF (cố tìm trong DB)
    for (const [basename, pdf] of pdfMap.entries()) {
      // Tìm số hóa đơn và ký hiệu từ tên file.
      // Dựa trên comment của user: "có thể ky hiệu và số hóa đơn bị đảo, hoặc là dính vào nhau"
      // Lấy toàn bộ chữ số liên tiếp từ chuỗi, normalize để match invoiceNo
      const digitsMatch = pdf.filename.match(/(\d{2,})/g);
      let foundInvoice: any = null;

      if (digitsMatch) {
        // Thử tìm theo tất cả các cụm số xuất hiện trong tên file
        for (const strNum of digitsMatch) {
          const normNo = normalizeInvoiceNo(strNum);
          if (!normNo) continue;

          // Tìm xem có hóa đơn nào match invoiceNoNormalized không
          // Để chính xác, chỉ tìm các hóa đơn có hướng (IN/OUT) tương ứng và thuộc đợt này
          foundInvoice = await this.repository.findOne({
            where: { invoiceNoNormalized: normNo, direction } as any,
          });

          if (foundInvoice) break;
        }
      }

      if (foundInvoice) {
        // Upload và attach vào foundInvoice
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const safeNo = foundInvoice.invoiceNo.replace(/[^\w-]/g, '_');
        const ts = Date.now();
        const safePdfName = pdf.filename.replace(/[^\w.-]/g, '_');
        const pdfKey = `invoices/${direction}/${yyyy}/${mm}/${safeNo}_${ts}_orphan_${safePdfName}`;

        try {
          await this.r2.uploadBuffer(
            pdfKey,
            pdf.buffer,
            pdf.mimetype || 'application/pdf',
          );

          const currentPdfFiles = Array.isArray(foundInvoice.pdfFiles)
            ? [...foundInvoice.pdfFiles]
            : [];
          currentPdfFiles.push({
            key: pdfKey,
            filename: pdf.filename,
            uploadedAt: new Date().toISOString(),
          });

          await this.repository.update(foundInvoice.id, {
            pdfFiles: currentPdfFiles,
            pdfFileKey: foundInvoice.pdfFileKey || pdfKey, // Set primary pdf nếu chưa có
          } as any);

          pdfAttached.push({
            filename: pdf.filename,
            invoiceNo: foundInvoice.invoiceNo,
          });
        } catch (r2Err) {
          pdfOrphans.push({
            filename: pdf.filename,
            reason: 'R2 upload failed',
          });
        }
      } else {
        pdfOrphans.push({
          filename: pdf.filename,
          reason: 'Không tìm thấy hóa đơn khớp',
        });
      }
    }

    return {
      importId,
      direction,
      total: files.length,
      created,
      skipped,
      errors,
      pdfAttached,
      pdfOrphans,
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

  async getPdfContent(invoiceId: string, fileKey: string): Promise<Buffer> {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);
    return this.r2.downloadBuffer(fileKey);
  }

  async getPdfDownloadUrl(invoiceId: string, fileKey: string, inline = false) {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const file = Array.isArray(invoice.pdfFiles)
      ? invoice.pdfFiles.find((f) => f.key === fileKey)
      : null;
    const filename = file
      ? file.filename
      : fileKey.split('/').pop() || 'document.pdf';

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

  async bulkDownloadFilesZip(
    payload: { query: ErpInvoiceQuery; types: string[] },
    res: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const archiver = require('archiver');
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    archive.on('error', (err: any) => {
      this.logger.error(`Error during zip creation: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).send({ error: err.message });
      }
    });

    archive.pipe(res);

    const qb = this.repository.createQueryBuilder('inv');
    qb.where('inv.is_deleted = false');

    if (payload.query.date_from) {
      qb.andWhere('inv.invoice_date >= :dateFrom', {
        dateFrom: payload.query.date_from,
      });
    }
    if (payload.query.date_to) {
      qb.andWhere('inv.invoice_date <= :dateTo', {
        dateTo: payload.query.date_to,
      });
    }
    if (payload.query.direction) {
      qb.andWhere('inv.direction = :direction', {
        direction: payload.query.direction,
      });
    }
    if (payload.query.status) {
      qb.andWhere('inv.status = :status', { status: payload.query.status });
    }
    if (payload.query.search) {
      qb.andWhere(
        '(inv.invoice_no ILIKE :search OR inv.document_no ILIKE :search OR inv.seller_name ILIKE :search OR inv.buyer_name ILIKE :search)',
        { search: `%${payload.query.search}%` },
      );
    }
    // Limit to prevent system overload
    qb.take(500);

    const invoices = await qb.getMany();
    let fileCount = 0;

    for (const invoice of invoices) {
      const partnerName =
        invoice.direction === 'IN' ? invoice.sellerName : invoice.buyerName;
      const taxCode =
        invoice.direction === 'IN'
          ? invoice.sellerTaxCode
          : invoice.buyerTaxCode;
      const sanitizedName = (partnerName || 'KhongTen')
        .replace(/[\\/:"*?<>|]/g, '-')
        .substring(0, 50);
      const sanitizedTaxCode = (taxCode || 'KhongMST').replace(
        /[\\/:"*?<>|]/g,
        '-',
      );
      const folderName = `${sanitizedTaxCode} - ${sanitizedName}`;
      const docNo = (invoice.invoiceNo || invoice.id).replace(
        /[\\/:"*?<>|]/g,
        '-',
      );

      if (payload.types.includes('pdf')) {
        const files: any[] = Array.isArray(invoice.pdfFiles)
          ? invoice.pdfFiles
          : [];
        if (files.length === 0 && invoice.pdfFileKey) {
          files.push({ key: invoice.pdfFileKey, filename: `${docNo}.pdf` });
        }
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          try {
            const stream = await this.r2.downloadStream(file.key);
            const ext = file.filename?.split('.').pop() || 'pdf';
            const finalName =
              files.length > 1 ? `${docNo}_${i + 1}.${ext}` : `${docNo}.${ext}`;
            archive.append(stream, { name: `${folderName}/${finalName}` });
            fileCount++;
          } catch (err) {
            this.logger.error(`Failed to stream PDF ${file.key}`, err);
          }
        }
      }

      if (payload.types.includes('xml') && invoice.xmlFileKey) {
        try {
          const stream = await this.r2.downloadStream(invoice.xmlFileKey);
          archive.append(stream, { name: `${folderName}/${docNo}.xml` });
          fileCount++;
        } catch (err) {
          this.logger.error(`Failed to stream XML ${invoice.xmlFileKey}`, err);
        }
      }
    }

    if (fileCount === 0) {
      archive.append('No files found or downloaded', { name: 'README.txt' });
    }

    await archive.finalize();
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

    let columnSearch: Record<string, string> = {};
    let columnFilters: Record<string, string[]> = {};
    try {
      if (query.column_search) columnSearch = JSON.parse(query.column_search);
      if (query.column_filters)
        columnFilters = JSON.parse(query.column_filters);
    } catch (e) {
      this.logger.error('Failed to parse column_search or column_filters', e);
    }

    // -------------------------------------------------------------
    // Dynamic Column Search
    // -------------------------------------------------------------
    Object.keys(columnSearch).forEach((key) => {
      const val = columnSearch[key];
      if (!val) return;

      if (key === 'invoiceNo') {
        qb.andWhere('inv.invoice_no ILIKE :invoiceNoSearch', {
          invoiceNoSearch: `%${val}%`,
        });
      } else if (key === 'serialNo') {
        qb.andWhere('inv.serial_no ILIKE :serialNoSearch', {
          serialNoSearch: `%${val}%`,
        });
      } else if (key === 'partner') {
        if (query.direction === 'IN') {
          qb.andWhere('inv.seller_name ILIKE :partnerSearch', {
            partnerSearch: `%${val}%`,
          });
        } else if (query.direction === 'OUT') {
          qb.andWhere('inv.buyer_name ILIKE :partnerSearch', {
            partnerSearch: `%${val}%`,
          });
        } else {
          qb.andWhere(
            '(inv.seller_name ILIKE :partnerSearch OR inv.buyer_name ILIKE :partnerSearch)',
            { partnerSearch: `%${val}%` },
          );
        }
      } else if (key === 'taxCode') {
        if (query.direction === 'IN') {
          qb.andWhere('inv.seller_tax_code ILIKE :taxCodeSearch', {
            taxCodeSearch: `%${val}%`,
          });
        } else if (query.direction === 'OUT') {
          qb.andWhere('inv.buyer_tax_code ILIKE :taxCodeSearch', {
            taxCodeSearch: `%${val}%`,
          });
        } else {
          qb.andWhere(
            '(inv.seller_tax_code ILIKE :taxCodeSearch OR inv.buyer_tax_code ILIKE :taxCodeSearch)',
            { taxCodeSearch: `%${val}%` },
          );
        }
      } else if (key === 'description') {
        qb.andWhere('inv.description ILIKE :descSearch', {
          descSearch: `%${val}%`,
        });
      } else if (key === 'preVatAmount') {
        qb.andWhere(
          "REPLACE(REPLACE(CAST(inv.pre_vat_amount AS TEXT), '.', ''), ',', '') ILIKE :preVatSearch",
          { preVatSearch: `%${val}%` },
        );
      } else if (key === 'vatAmount') {
        qb.andWhere(
          "REPLACE(REPLACE(CAST(inv.vat_amount AS TEXT), '.', ''), ',', '') ILIKE :vatSearch",
          { vatSearch: `%${val}%` },
        );
      } else if (key === 'discountAmount') {
        qb.andWhere(
          "REPLACE(REPLACE(CAST(inv.discount_amount AS TEXT), '.', ''), ',', '') ILIKE :discountSearch",
          { discountSearch: `%${val}%` },
        );
      } else if (key === 'totalAmount') {
        qb.andWhere(
          "REPLACE(REPLACE(CAST(inv.total_amount AS TEXT), '.', ''), ',', '') ILIKE :totalSearch",
          { totalSearch: `%${val}%` },
        );
      } else if (key === 'settlementOrder') {
        qb.andWhere('inv.settlement_order ILIKE :settlementSearch', {
          settlementSearch: `%${val}%`,
        });
      } else if (key === 'licensePlate') {
        qb.andWhere('inv.license_plate ILIKE :plateSearch', {
          plateSearch: `%${val}%`,
        });
      }
    });

    // -------------------------------------------------------------
    // Dynamic Column Filters
    // -------------------------------------------------------------
    Object.keys(columnFilters).forEach((key) => {
      const vals = columnFilters[key];
      if (!vals || vals.length === 0) return;

      if (key === 'status') {
        qb.andWhere('inv.status IN (:...statusVals)', { statusVals: vals });
      } else if (key === 'postingStatus') {
        qb.andWhere('inv.posting_status IN (:...postingStatusVals)', {
          postingStatusVals: vals,
        });
      } else if (key === 'branchId') {
        qb.andWhere('inv.branch_id IN (:...branchVals)', { branchVals: vals });
      } else if (key === 'invoiceDate') {
        qb.andWhere(
          `TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') IN (:...invoiceDateVals)`,
          {
            invoiceDateVals: vals,
          },
        );
      } else if (key === 'serialNo') {
        qb.andWhere('inv.serial_no IN (:...serialNoVals)', {
          serialNoVals: vals,
        });
      } else if (key === 'invoiceNo') {
        qb.andWhere('inv.invoice_no IN (:...invoiceNoVals)', {
          invoiceNoVals: vals,
        });
      } else if (key === 'partner') {
        if (query.direction === 'IN') {
          qb.andWhere('inv.seller_name IN (:...partnerVals)', {
            partnerVals: vals,
          });
        } else if (query.direction === 'OUT') {
          qb.andWhere('inv.buyer_name IN (:...partnerVals)', {
            partnerVals: vals,
          });
        } else {
          qb.andWhere(
            'COALESCE(inv.seller_name, inv.buyer_name) IN (:...partnerVals)',
            { partnerVals: vals },
          );
        }
      } else if (key === 'taxCode') {
        if (query.direction === 'IN') {
          qb.andWhere('inv.seller_tax_code IN (:...taxCodeVals)', {
            taxCodeVals: vals,
          });
        } else if (query.direction === 'OUT') {
          qb.andWhere('inv.buyer_tax_code IN (:...taxCodeVals)', {
            taxCodeVals: vals,
          });
        } else {
          qb.andWhere(
            'COALESCE(inv.seller_tax_code, inv.buyer_tax_code) IN (:...taxCodeVals)',
            { taxCodeVals: vals },
          );
        }
      } else if (key === 'description') {
        qb.andWhere('inv.description IN (:...descVals)', { descVals: vals });
      } else if (key === 'preVatAmount') {
        qb.andWhere('CAST(inv.pre_vat_amount AS TEXT) IN (:...preVatVals)', {
          preVatVals: vals,
        });
      } else if (key === 'vatAmount') {
        qb.andWhere('CAST(inv.vat_amount AS TEXT) IN (:...vatVals)', {
          vatVals: vals,
        });
      } else if (key === 'discountAmount') {
        qb.andWhere('CAST(inv.discount_amount AS TEXT) IN (:...discountVals)', {
          discountVals: vals,
        });
      } else if (key === 'totalAmount') {
        qb.andWhere('CAST(inv.total_amount AS TEXT) IN (:...totalVals)', {
          totalVals: vals,
        });
      } else if (key === 'settlementOrder') {
        qb.andWhere('inv.settlement_order IN (:...settleVals)', {
          settleVals: vals,
        });
      } else if (key === 'licensePlate') {
        qb.andWhere('inv.license_plate IN (:...plateVals)', {
          plateVals: vals,
        });
      }
    });

    let orderColumn = 'inv.invoiceDate';
    let orderDirection: 'ASC' | 'DESC' = 'DESC';
    if (query.sort_by) {
      if (query.sort_by === 'invoiceNo') orderColumn = 'inv.invoiceNo';
      else if (query.sort_by === 'totalAmount') orderColumn = 'inv.totalAmount';
      else if (query.sort_by === 'sellerName') orderColumn = 'inv.sellerName';
      else if (query.sort_by === 'buyerName') orderColumn = 'inv.buyerName';
      else if (query.sort_by === 'status') orderColumn = 'inv.status';
      else if (query.sort_by === 'invoiceDate') orderColumn = 'inv.invoiceDate';
      else if (query.sort_by === 'serialNo') orderColumn = 'inv.serialNo';
      else if (query.sort_by === 'partner') {
        if (query.direction === 'IN') orderColumn = 'inv.sellerName';
        else orderColumn = 'inv.buyerName';
      } else if (query.sort_by === 'taxCode') {
        if (query.direction === 'IN') orderColumn = 'inv.sellerTaxCode';
        else orderColumn = 'inv.buyerTaxCode';
      } else if (query.sort_by === 'description')
        orderColumn = 'inv.description';
      else if (query.sort_by === 'preVatAmount')
        orderColumn = 'inv.preVatAmount';
      else if (query.sort_by === 'vatAmount') orderColumn = 'inv.vatAmount';
      else if (query.sort_by === 'discountAmount')
        orderColumn = 'inv.discountAmount';
      else if (query.sort_by === 'licensePlate')
        orderColumn = 'inv.licensePlate';
      else if (query.sort_by === 'settlementOrder')
        orderColumn = 'inv.settlementOrder';
      else if (query.sort_by === 'branchId') orderColumn = 'inv.branchId';
    }
    if (query.sort_order) {
      orderDirection = query.sort_order.toUpperCase() as 'ASC' | 'DESC';
    }

    qb.orderBy(orderColumn, orderDirection).addOrderBy('inv.createdAt', 'DESC');

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

  async postInvoice(id: string, dto: PostInvoiceDto) {
    const invoice = await this.repository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.isDeleted) throw new BadRequestException('Invoice is deleted');
    if (invoice.postingStatus === 'POSTED')
      throw new BadRequestException('Invoice is already posted');

    if (!invoice.branchId) {
      throw new BadRequestException(
        'Hóa đơn chưa có chi nhánh. Vui lòng gán chi nhánh trước khi hạch toán.',
      );
    }

    const totalDebit = dto.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = dto.lines.reduce((sum, line) => sum + line.credit, 0);

    const invTotal = parseFloat(invoice.totalAmount);
    if (
      Math.abs(totalDebit - invTotal) > 0.01 ||
      Math.abs(totalCredit - invTotal) > 0.01
    ) {
      throw new BadRequestException(
        'Total debit and credit must equal the invoice total amount',
      );
    }

    const entryNoPrefix = invoice.direction === 'IN' ? 'HĐM' : 'HĐB';

    const invoiceRef = invoice.serialNo
      ? `${invoice.invoiceNo}-${invoice.serialNo}`
      : invoice.invoiceNo;

    const defaultDesc = `Hạch toán hóa đơn ${invoice.invoiceNo}`;
    const userDesc = dto.description || invoice.description || defaultDesc;
    const description = `${invoiceRef}_${userDesc}`;

    const documentDate = dto.documentDate
      ? new Date(dto.documentDate)
      : new Date(invoice.invoiceDate);

    const journalEntry = await this.accountingCoreService.createJournalEntry({
      branchId: invoice.branchId,
      date: new Date(dto.postingDate),
      documentDate,
      reference: invoiceRef,
      description,
      subjectName:
        invoice.direction === 'IN'
          ? invoice.sellerName || undefined
          : invoice.buyerName || undefined,
      sourceType: 'INVOICE',
      sourceId: invoice.id,
      entryNoPrefix,
      lines: dto.lines.map((line) => {
        let lineDesc = line.description || description;
        if (line.description && !line.description.startsWith(invoiceRef)) {
          lineDesc = `${invoiceRef}_${line.description}`;
        }
        return {
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          description: lineDesc,
        };
      }),
    });

    invoice.postingStatus = 'POSTED';
    invoice.postingDate = dto.postingDate;
    invoice.journalEntryId = journalEntry.id;

    await this.repository.save(invoice);
    return invoice;
  }

  async unpostInvoice(id: string) {
    const invoice = await this.repository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.postingStatus !== 'POSTED')
      throw new BadRequestException('Invoice is not posted');

    await this.accountingCoreService.deleteJournalEntryBySource(
      invoice.id,
      'INVOICE',
    );

    // Xóa các bút toán cấn trừ liên quan
    const netOffs = await this.repository.manager.find(
      ErpInvoiceVoucherNetOff,
      {
        where: { invoiceId: id },
      },
    );
    if (netOffs && netOffs.length > 0) {
      await this.repository.manager.delete(ErpInvoiceVoucherNetOff, {
        invoiceId: id,
      });
      const uniqueTxnIds = [
        ...new Set(netOffs.map((n) => n.bankTransactionId)),
      ];
      for (const txnId of uniqueTxnIds) {
        await this.bankTransactionsCoreService.refreshJournalEntriesForBankTransaction(
          txnId,
        );
      }
    }

    invoice.postingStatus = 'UNPOSTED';
    invoice.postingDate = null;
    invoice.journalEntryId = null;

    await this.repository.save(invoice);
    return invoice;
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
  pdfAttached?: any[];
  pdfOrphans?: any[];
}
