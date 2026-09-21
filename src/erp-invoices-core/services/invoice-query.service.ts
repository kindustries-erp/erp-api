import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import * as ExcelJS from 'exceljs';

import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../../common/utils/query-builder.util';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import { ErpInvoiceItem } from '../entities/erp_invoice_item.entity';
import { ErpEntityAttributeValue } from '../../module-config/entities/erp_entity_attribute_value.entity';
import {
  toInvoiceDto,
  parseVatRateForDisplay,
} from '../helpers/invoice-mapper.helper';
import {
  classifyInvoiceLine,
  resolveOutInvoiceBranchCode,
} from '../helpers/out-invoice-display.helper';
import type { ErpInvoiceQuery } from '../erp-invoices-core.service';

export interface ErpInvoiceItemQuery {
  direction?: 'IN' | 'OUT';
  search?: string;
  invoice_no?: string;
  serial_no?: string;
  seller_name?: string;
  buyer_name?: string;
  partner_tax_code?: string;
  item_code?: string;
  description?: string;
  invoice_subcategory?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  posting_status?: string;
  tag_id?: string;
  page?: number;
  pageSize?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  column_search?: string;
  column_filters?: string;
}

@Injectable()
export class InvoiceQueryService {
  private readonly logger = new Logger(InvoiceQueryService.name);

  public static readonly EXPORT_PROGRESS_TOTAL_UNITS = 100;

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    @InjectRepository(ErpEntityAttributeValue)
    private readonly entityAttrValueRepo: Repository<ErpEntityAttributeValue>,
    @Optional()
    @InjectRepository(ErpInvoiceItem)
    private readonly itemRepository?: Repository<ErpInvoiceItem>,
  ) {}

  // ---------------------------------------------------------------------------
  // Column options for advanced filter UI
  // ---------------------------------------------------------------------------

  async getColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    direction?: 'IN' | 'OUT',
  ) {
    const qb = this.repository.createQueryBuilder('inv');

    qb.where('inv.is_deleted = false');
    if (direction) {
      qb.andWhere('inv.direction = :direction', { direction });
    }

    let selectField = '';
    let isDateColumn = false;
    let isCustomGroupColumn = false;
    let customSecondaryField = '';

    if (column === 'invoiceDate') {
      selectField = "TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')";
      isDateColumn = true;
    } else if (column === 'serialNo') {
      selectField = 'TRIM(inv.serial_no)';
    } else if (column === 'invoiceNo') {
      selectField = 'TRIM(inv.invoice_no)';
      customSecondaryField = 'TRIM(inv.serial_no)';
      isCustomGroupColumn = true;
    } else if (column === 'partner') {
      isCustomGroupColumn = true;
      if (direction === 'IN') {
        selectField = "TRIM(COALESCE(inv.seller_name, ''))";
        customSecondaryField = "TRIM(COALESCE(inv.seller_tax_code, ''))";
      } else if (direction === 'OUT') {
        selectField =
          "TRIM(COALESCE(NULLIF(inv.buyer_name, ''), inv.buyer_personal_name, ''))";
        customSecondaryField = "TRIM(COALESCE(inv.buyer_tax_code, ''))";
      } else {
        selectField =
          "TRIM(CASE WHEN inv.direction = 'IN' THEN COALESCE(inv.seller_name, '') ELSE COALESCE(NULLIF(inv.buyer_name, ''), inv.buyer_personal_name, '') END)";
        customSecondaryField =
          "TRIM(CASE WHEN inv.direction = 'IN' THEN COALESCE(inv.seller_tax_code, '') ELSE COALESCE(inv.buyer_tax_code, '') END)";
      }
    } else if (column === 'taxCode') {
      if (direction === 'IN') selectField = 'TRIM(inv.seller_tax_code)';
      else if (direction === 'OUT') selectField = 'TRIM(inv.buyer_tax_code)';
      else
        selectField =
          "TRIM(CASE WHEN inv.direction = 'IN' THEN inv.seller_tax_code WHEN inv.direction = 'OUT' THEN inv.buyer_tax_code END)";
    } else if (column === 'description') selectField = 'inv.description';
    else if (column === 'preVatAmount') selectField = 'inv.pre_vat_amount';
    else if (column === 'vatRate') selectField = 'inv.vat_rate';
    else if (column === 'vatAmount') selectField = 'inv.vat_amount';
    else if (column === 'discountAmount') selectField = 'inv.discount_amount';
    else if (column === 'totalAmount') selectField = 'inv.total_amount';
    else if (column === 'licensePlate') selectField = 'inv.license_plate';
    else if (column === 'settlementOrder') selectField = 'inv.settlement_order';
    else if (column === 'branchId') selectField = 'inv.branch_id';
    else if (column === 'notes') selectField = 'inv.notes';
    else return { items: [], total: 0, page, pageSize, totalPages: 0 };

    if (isCustomGroupColumn) {
      qb.select(`${selectField}`, 'value').addSelect(
        `${customSecondaryField}`,
        'secondary_val',
      );
      qb.andWhere(
        `((${selectField} IS NOT NULL AND CAST(${selectField} AS TEXT) != '') OR (${customSecondaryField} IS NOT NULL AND CAST(${customSecondaryField} AS TEXT) != ''))`,
      );
      qb.groupBy(`${selectField}`).addGroupBy(`${customSecondaryField}`);
    } else {
      qb.select(`DISTINCT ${selectField}`, 'value');
      if (isDateColumn) {
        qb.andWhere('inv.invoice_date IS NOT NULL');
        qb.andWhere(`${selectField} != ''`);
      } else {
        qb.andWhere(`${selectField} IS NOT NULL`);
        qb.andWhere(`CAST(${selectField} AS TEXT) != ''`);
      }
    }

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        const activeFilters: Record<string, string[]> = {};
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue;
          if (col === 'taxInvoiceStatus') {
            qb.andWhere(
              'inv.tax_invoice_status IN (:...vals_taxInvoiceStatus)',
              {
                vals_taxInvoiceStatus: vals.map((v) => Number(v)),
              },
            );
            continue;
          }
          activeFilters[col] = vals;
        }
        if (Object.keys(activeFilters).length > 0) {
          this._applyColumnFilters(qb, activeFilters, direction);
        }
      } catch {
        // ignore malformed filters
      }
    }

    if (search) {
      if (column === 'invoiceNo') {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['inv.invoice_no', 'inv.serial_no'],
          search,
          'search_invoiceNo',
        );
      } else if (column === 'partner') {
        if (direction === 'IN') {
          applyMultiKeywordMultiFieldFilter(
            qb,
            ['inv.seller_name', 'inv.seller_tax_code'],
            search,
            'search_partner',
          );
        } else if (direction === 'OUT') {
          applyMultiKeywordMultiFieldFilter(
            qb,
            ['inv.buyer_name', 'inv.buyer_personal_name', 'inv.buyer_tax_code'],
            search,
            'search_partner',
          );
        } else {
          applyMultiKeywordMultiFieldFilter(
            qb,
            [
              'inv.seller_name',
              'inv.seller_tax_code',
              'inv.buyer_name',
              'inv.buyer_personal_name',
              'inv.buyer_tax_code',
            ],
            search,
            'search_partner',
          );
        }
      } else {
        let searchField = `CAST(${selectField} AS TEXT)`;
        let searchKeyword = search;

        if (
          [
            'preVatAmount',
            'vatAmount',
            'discountAmount',
            'totalAmount',
          ].includes(column)
        ) {
          searchField = `REPLACE(REPLACE(CAST(${selectField} AS TEXT), '.', ''), ',', '')`;
          searchKeyword = search.replace(/[,.]/g, '');
        }

        applyMultiKeywordFilter(qb, searchField, searchKeyword, 'search');
      }
    }

    qb.orderBy('value', 'ASC');

    const countQb = qb.clone();
    if (countQb.expressionMap) {
      countQb.expressionMap.groupBys = [];
      countQb.expressionMap.selects = [];
      countQb.expressionMap.orderBys = {};
    }
    countQb.offset?.(undefined);
    countQb.limit?.(undefined);
    countQb.skip?.(undefined);
    countQb.take?.(undefined);

    let total = 0;
    if (isCustomGroupColumn) {
      const totalRaw = await countQb
        .select(
          `COUNT(DISTINCT CONCAT(COALESCE(${selectField}, ''), ':', COALESCE(${customSecondaryField}, '')))`,
          'cnt',
        )
        .getRawOne();
      total = parseInt(totalRaw?.cnt || '0', 10);
    } else {
      const totalRaw = await countQb
        .select(`COUNT(DISTINCT ${selectField})`, 'cnt')
        .getRawOne();
      total = parseInt(totalRaw?.cnt || '0', 10);
    }

    qb.offset((page - 1) * pageSize).limit(pageSize);
    const results = await qb.getRawMany();

    let items: any[] = [];
    if (column === 'invoiceNo') {
      const seen = new Set<string>();
      items = results
        .map((r) => {
          const val = r.value ? String(r.value).trim() : '';
          const sec = r.secondary_val ? String(r.secondary_val).trim() : '';
          const label = sec ? `${val} (${sec})` : val;
          const value = sec ? `${val}:::${sec}` : val;
          return { value, label: label || val };
        })
        .filter((x) => {
          if (!x.value || seen.has(x.value)) return false;
          seen.add(x.value);
          return true;
        });
    } else if (column === 'partner') {
      const seen = new Set<string>();
      items = results
        .map((r) => {
          const name = r.value ? String(r.value).trim() : '';
          const tax = r.secondary_val ? String(r.secondary_val).trim() : '';
          const label = name && tax ? `${name} (${tax})` : name || tax || '—';
          const value = tax && name ? `${tax}:::${name}` : tax || name;
          return { value, label };
        })
        .filter((x) => {
          if (!x.value || seen.has(x.value)) return false;
          seen.add(x.value);
          return true;
        });
    } else {
      items = results.map((r) => String(r.value)).filter(Boolean);
    }

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ---------------------------------------------------------------------------
  // Find all with pagination, sort, filter
  // ---------------------------------------------------------------------------

  async findAll(query: ErpInvoiceQuery) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 40;

    let orderColumn = 'inv.invoiceDate';
    let orderProperty = 'invoiceDate';
    let orderDirection: 'ASC' | 'DESC' = 'DESC';

    if (query.sort_by) {
      const sortMap: Record<string, [string, string]> = {
        invoiceNo: ['inv.invoiceNo', 'invoiceNo'],
        totalAmount: ['inv.totalAmount', 'totalAmount'],
        sellerName: ['inv.sellerName', 'sellerName'],
        buyerName: ['inv.buyerName', 'buyerName'],
        status: ['inv.status', 'status'],
        invoiceDate: ['inv.invoiceDate', 'invoiceDate'],
        serialNo: ['inv.serialNo', 'serialNo'],
        description: ['inv.description', 'description'],
        preVatAmount: ['inv.preVatAmount', 'preVatAmount'],
        vatRate: ['inv.vatRate', 'vatRate'],
        vatAmount: ['inv.vatAmount', 'vatAmount'],
        discountAmount: ['inv.discountAmount', 'discountAmount'],
        licensePlate: ['inv.licensePlate', 'licensePlate'],
        settlementOrder: ['inv.settlementOrder', 'settlementOrder'],
        branchId: ['inv.branchId', 'branchId'],
      };

      if (query.sort_by === 'partner') {
        const col =
          query.direction === 'IN'
            ? ['inv.sellerName', 'sellerName']
            : ['inv.buyerName', 'buyerName'];
        orderColumn = col[0];
        orderProperty = col[1];
      } else if (query.sort_by === 'taxCode') {
        const col =
          query.direction === 'IN'
            ? ['inv.sellerTaxCode', 'sellerTaxCode']
            : ['inv.buyerTaxCode', 'buyerTaxCode'];
        orderColumn = col[0];
        orderProperty = col[1];
      } else if (sortMap[query.sort_by]) {
        [orderColumn, orderProperty] = sortMap[query.sort_by];
      }
    }
    if (query.sort_order) {
      orderDirection = query.sort_order.toUpperCase() as 'ASC' | 'DESC';
    }

    const where: any = { isDeleted: false };
    if (query.direction) where.direction = query.direction;
    if (query.status) where.status = query.status;
    if (query.is_valid)
      where.isValid = query.is_valid === 'true' || query.is_valid === '1';

    let effectiveDateTo = query.date_to;
    if (effectiveDateTo && effectiveDateTo.length === 10)
      effectiveDateTo = `${effectiveDateTo} 23:59:59.999`;

    if (query.date_from && effectiveDateTo)
      where.invoiceDate = Between(query.date_from, effectiveDateTo);
    else if (query.date_from)
      where.invoiceDate = MoreThanOrEqual(query.date_from);
    else if (effectiveDateTo)
      where.invoiceDate = LessThanOrEqual(effectiveDateTo);

    let columnSearch: Record<string, string> = {};
    let columnFilters: Record<string, string[]> = {};
    try {
      if (query.column_search) columnSearch = JSON.parse(query.column_search);
      if (query.column_filters)
        columnFilters = JSON.parse(query.column_filters);
    } catch (e) {
      this.logger.error('Failed to parse column_search or column_filters', e);
    }

    const needsQb = !!(
      query.search ||
      query.invoice_no ||
      query.serial_no ||
      query.related_invoice_no ||
      query.related_serial_no ||
      query.tax_invoice_status !== undefined ||
      query.seller_name ||
      query.buyer_name ||
      query.partner_tax_code ||
      query.tag_id ||
      query.sort_by === 'invoiceNo' ||
      query.sort_by === 'netOffAmount' ||
      query.sort_by === 'remainingAmount' ||
      Object.keys(columnSearch).length > 0 ||
      Object.keys(columnFilters).length > 0 ||
      !!query.unlinked_po_id
    );

    const qb = this.repository
      .createQueryBuilder('inv')
      .leftJoin(
        '(SELECT invoice_id, SUM(net_off_amount) as net_off_sum FROM erp_invoice_voucher_netoff GROUP BY invoice_id)',
        'netoff_agg',
        'netoff_agg.invoice_id = inv.id',
      )
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

    if (query.unlinked_po_id) {
      qb.andWhere(
        '(inv.purchase_order_id IS NULL OR inv.purchase_order_id = :unlinkedPoId)',
        {
          unlinkedPoId: query.unlinked_po_id,
        },
      );
    }

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
    if (query.seller_name)
      qb.andWhere('inv.seller_name ILIKE :sn', {
        sn: `%${query.seller_name}%`,
      });
    if (query.buyer_name)
      qb.andWhere('inv.buyer_name ILIKE :bn', {
        bn: `%${query.buyer_name}%`,
      });
    if (query.partner_tax_code)
      qb.andWhere('(inv.seller_tax_code = :ptc OR inv.buyer_tax_code = :ptc)', {
        ptc: query.partner_tax_code,
      });
    if (query.id) {
      qb.andWhere('inv.id = :invId', { invId: query.id });
    }
    if (query.tag_id)
      qb.andWhere(
        `inv.id IN (SELECT entity_id FROM sys_entity_tags WHERE entity_type = 'erp_invoice' AND tag_id = :tagId)`,
        { tagId: query.tag_id },
      );
    if (query.invoice_no)
      qb.andWhere('inv.invoice_no = :invNo', { invNo: query.invoice_no });
    if (query.serial_no)
      qb.andWhere('inv.serial_no = :serNo', { serNo: query.serial_no });
    if (query.related_invoice_no)
      qb.andWhere('inv.related_invoice_no = :relInvNo', {
        relInvNo: query.related_invoice_no,
      });
    if (query.related_serial_no)
      qb.andWhere('inv.related_serial_no = :relSerNo', {
        relSerNo: query.related_serial_no,
      });
    if (
      query.tax_invoice_status !== undefined &&
      query.tax_invoice_status !== null &&
      query.tax_invoice_status !== ''
    )
      qb.andWhere('inv.tax_invoice_status = :taxInvStat', {
        taxInvStat: Number(query.tax_invoice_status),
      });

    this._applyColumnSearch(qb, columnSearch, query.direction);
    this._applyColumnFilters(qb, columnFilters, query.direction);

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
      .leftJoinAndSelect('inv.attachments', 'link')
      .leftJoinAndSelect('link.attachment', 'attachment')
      .leftJoinAndSelect('inv.category', 'category')
      .addOrderBy('inv.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const mappedItems = await this._loadNetOffAmounts(searchResults[0]);
    await this._loadCustomAttributes(mappedItems);

    const total = searchResults[1];
    const totalPages = Math.ceil(total / pageSize);

    // Calculate Grand Totals and Cumulative Totals
    let grandTotalPreVat = 0;
    let grandTotalVat = 0;
    let grandTotalDiscount = 0;
    let grandTotalAmount = 0;
    let grandTotalNetOff = 0;
    let grandTotalRemaining = 0;

    let cumulativePreVat = 0;
    let cumulativeVat = 0;
    let cumulativeDiscount = 0;
    let cumulativeTotal = 0;
    let cumulativeNetOff = 0;
    let cumulativeRemaining = 0;

    try {
      const totalsQb = qb.clone();
      if (totalsQb.expressionMap) {
        totalsQb.expressionMap.orderBys = {};
        totalsQb.expressionMap.selects = [];
      }
      totalsQb.offset?.(undefined);
      totalsQb.limit?.(undefined);
      totalsQb.skip?.(undefined);
      totalsQb.take?.(undefined);
      totalsQb
        .select('COALESCE(SUM(inv.pre_vat_amount), 0)', 'totalPreVat')
        .addSelect('COALESCE(SUM(inv.vat_amount), 0)', 'totalVat')
        .addSelect('COALESCE(SUM(inv.discount_amount), 0)', 'totalDiscount')
        .addSelect('COALESCE(SUM(inv.total_amount), 0)', 'totalAmount')
        .addSelect(
          'COALESCE(SUM(COALESCE(netoff_agg.net_off_sum, 0)), 0)',
          'totalNetOff',
        );

      const totalsRaw = await totalsQb.getRawOne();
      grandTotalPreVat = parseFloat(totalsRaw?.totalPreVat || '0') || 0;
      grandTotalVat = parseFloat(totalsRaw?.totalVat || '0') || 0;
      grandTotalDiscount = parseFloat(totalsRaw?.totalDiscount || '0') || 0;
      grandTotalAmount = parseFloat(totalsRaw?.totalAmount || '0') || 0;
      grandTotalNetOff = parseFloat(totalsRaw?.totalNetOff || '0') || 0;
      grandTotalRemaining = grandTotalAmount - grandTotalNetOff;

      if (page === 1) {
        cumulativePreVat = mappedItems.reduce(
          (acc, curr) => acc + (parseFloat(curr.preVatAmount) || 0),
          0,
        );
        cumulativeVat = mappedItems.reduce(
          (acc, curr) => acc + (parseFloat(curr.vatAmount) || 0),
          0,
        );
        cumulativeDiscount = mappedItems.reduce(
          (acc, curr) => acc + (parseFloat(curr.discountAmount) || 0),
          0,
        );
        cumulativeTotal = mappedItems.reduce(
          (acc, curr) => acc + (parseFloat(curr.totalAmount) || 0),
          0,
        );
        cumulativeNetOff = mappedItems.reduce(
          (acc, curr) => acc + (parseFloat((curr as any).netOffAmount) || 0),
          0,
        );
        cumulativeRemaining = cumulativeTotal - cumulativeNetOff;
      } else if (page >= totalPages && totalPages > 0) {
        cumulativePreVat = grandTotalPreVat;
        cumulativeVat = grandTotalVat;
        cumulativeDiscount = grandTotalDiscount;
        cumulativeTotal = grandTotalAmount;
        cumulativeNetOff = grandTotalNetOff;
        cumulativeRemaining = grandTotalRemaining;
      } else {
        const cumQb = qb.clone();
        if (cumQb.expressionMap) {
          cumQb.expressionMap.selects = [];
        }
        cumQb
          .select('inv.pre_vat_amount', 'preVat')
          .addSelect('inv.vat_amount', 'vat')
          .addSelect('inv.discount_amount', 'discount')
          .addSelect('inv.total_amount', 'total')
          .addSelect('COALESCE(netoff_agg.net_off_sum, 0)', 'netoff')
          .offset(0)
          .limit(page * pageSize);
        cumQb.skip?.(undefined);
        cumQb.take?.(undefined);

        const cumRows = await cumQb.getRawMany();
        cumulativePreVat = cumRows.reduce(
          (acc, r) =>
            acc + (parseFloat(r.preVat ?? r.inv_pre_vat_amount ?? 0) || 0),
          0,
        );
        cumulativeVat = cumRows.reduce(
          (acc, r) => acc + (parseFloat(r.vat ?? r.inv_vat_amount ?? 0) || 0),
          0,
        );
        cumulativeDiscount = cumRows.reduce(
          (acc, r) =>
            acc + (parseFloat(r.discount ?? r.inv_discount_amount ?? 0) || 0),
          0,
        );
        cumulativeTotal = cumRows.reduce(
          (acc, r) =>
            acc + (parseFloat(r.total ?? r.inv_total_amount ?? 0) || 0),
          0,
        );
        cumulativeNetOff = cumRows.reduce(
          (acc, r) =>
            acc + (parseFloat(r.netoff ?? r.netoff_agg_net_off_sum ?? 0) || 0),
          0,
        );
        cumulativeRemaining = cumulativeTotal - cumulativeNetOff;
      }
    } catch (e) {
      this.logger.error(`Error calculating totals in findAll invoices: ${e}`);
    }

    return {
      items: mappedItems.map((i: any) => toInvoiceDto(i)),
      total,
      page,
      pageSize,
      totalPages,
      totals: {
        grandTotalPreVat,
        grandTotalVat,
        grandTotalDiscount,
        grandTotalAmount,
        grandTotalNetOff,
        grandTotalRemaining,
        cumulativePreVat,
        cumulativeVat,
        cumulativeDiscount,
        cumulativeTotal,
        cumulativeNetOff,
        cumulativeRemaining,
      },
    };
  }

  /**
   * Batch load custom and global attributes for a list of invoices
   */
  private async _loadCustomAttributes(items: ErpInvoice[]): Promise<void> {
    const invoiceIds = items.map((i) => i.id).filter(Boolean);
    if (invoiceIds.length === 0) return;

    try {
      const attrValues = await this.entityAttrValueRepo.find({
        where: {
          entityType: In(['INVOICE', 'INVOICE_IN', 'INVOICE_OUT']),
          entityId: In(invoiceIds),
        },
        relations: ['attrDef'],
      });

      const map: Record<
        string,
        {
          attributes: Record<string, any>;
          globalAttributes: Record<string, any>;
          attributeValues: any[];
        }
      > = {};

      for (const ev of attrValues) {
        if (!map[ev.entityId]) {
          map[ev.entityId] = {
            attributes: {},
            globalAttributes: {},
            attributeValues: [],
          };
        }
        const entry = map[ev.entityId];
        if (ev.attrDef?.isGlobal) {
          entry.globalAttributes[ev.attrDefId] = ev.valueText;
          if (ev.attrDef?.code) {
            entry.globalAttributes[ev.attrDef.code] = ev.valueText;
          }
        } else {
          entry.attributes[ev.attrDefId] = ev.valueText;
          if (ev.attrDef?.code) {
            entry.attributes[ev.attrDef.code] = ev.valueText;
          }
        }
        entry.attributeValues.push({
          id: ev.id,
          attrDefId: ev.attrDefId,
          attrCode: ev.attrDef?.code,
          attrName: ev.attrDef?.name,
          fieldType: ev.attrDef?.fieldType,
          valueText: ev.valueText,
          isGlobal: ev.attrDef?.isGlobal || false,
        });
      }

      for (const item of items) {
        const customData = map[item.id];
        if (customData) {
          (item as any).attributes = customData.attributes;
          (item as any).globalAttributes = customData.globalAttributes;
          (item as any).customAttributes = customData.attributes;
          (item as any).attributeValues = customData.attributeValues;
        } else {
          (item as any).attributes = {};
          (item as any).globalAttributes = {};
          (item as any).customAttributes = {};
          (item as any).attributeValues = [];
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to batch load invoice custom attributes: ${err?.message}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Excel export — replicates findAll filter logic then writes spreadsheet
  // ---------------------------------------------------------------------------

  async exportExcel(
    query: ErpInvoiceQuery,
    options?: {
      onProgress?: (current: number, total: number, message: string) => void;
    },
  ): Promise<Buffer> {
    const totalUnits = InvoiceQueryService.EXPORT_PROGRESS_TOTAL_UNITS;
    const emitProgress = (current: number, message: string) => {
      options?.onProgress?.(
        Math.max(0, Math.min(totalUnits, current)),
        totalUnits,
        message,
      );
    };

    emitProgress(5, 'Dang truy van danh sach hoa don...');

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

    if (query.search)
      qb.andWhere(
        `(inv.invoice_no ILIKE :q OR inv.serial_no ILIKE :q OR inv.buyer_name ILIKE :q OR inv.seller_name ILIKE :q OR inv.buyer_tax_code ILIKE :q OR inv.seller_tax_code ILIKE :q)`,
        { q: `%${query.search}%` },
      );
    if (query.seller_name)
      qb.andWhere('inv.seller_name ILIKE :sn', {
        sn: `%${query.seller_name}%`,
      });
    if (query.buyer_name)
      qb.andWhere('inv.buyer_name ILIKE :bn', {
        bn: `%${query.buyer_name}%`,
      });
    if (query.id) {
      qb.andWhere('inv.id = :invId', { invId: query.id });
    }
    if (query.invoice_no) {
      qb.andWhere('inv.invoice_no = :invNo', { invNo: query.invoice_no });
    }
    if (query.serial_no) {
      qb.andWhere('inv.serial_no = :serNo', { serNo: query.serial_no });
    }
    if (query.tag_id)
      qb.andWhere(
        `inv.id IN (SELECT entity_id FROM sys_entity_tags WHERE entity_type = 'erp_invoice' AND tag_id = :tagId)`,
        { tagId: query.tag_id },
      );

    let columnSearch: Record<string, string> = {};
    let columnFilters: Record<string, string[]> = {};
    try {
      if (query.column_search) columnSearch = JSON.parse(query.column_search);
      if (query.column_filters)
        columnFilters = JSON.parse(query.column_filters);
    } catch (e) {
      this.logger.error('Failed to parse column_search or column_filters', e);
    }

    this._applyColumnSearch(qb, columnSearch, query.direction);
    this._applyColumnFiltersExport(qb, columnFilters, query.direction);

    const needsNetOffJoin =
      query.sort_by === 'netOffAmount' ||
      query.sort_by === 'remainingAmount' ||
      columnSearch['netOffAmount'] !== undefined ||
      columnSearch['remainingAmount'] !== undefined ||
      (columnFilters['netOffAmount'] &&
        columnFilters['netOffAmount'].length > 0) ||
      (columnFilters['remainingAmount'] &&
        columnFilters['remainingAmount'].length > 0);

    if (needsNetOffJoin) {
      qb.leftJoin(
        '(SELECT invoice_id, SUM(net_off_amount) as net_off_sum FROM erp_invoice_voucher_netoff GROUP BY invoice_id)',
        'netoff_agg',
        'netoff_agg.invoice_id = inv.id',
      );
    }

    let orderColumn = 'inv.invoiceDate';
    let orderDirection: 'ASC' | 'DESC' = 'DESC';
    if (query.sort_by) {
      const col = this._mapSortByToQbColumn(query.sort_by, query.direction);
      if (col) orderColumn = col;
    }
    if (query.sort_order)
      orderDirection = query.sort_order.toUpperCase() as 'ASC' | 'DESC';

    qb.orderBy(orderColumn, orderDirection).addOrderBy('inv.createdAt', 'DESC');
    let items = await qb.getMany();
    emitProgress(
      35,
      `Da tai ${items.length} hoa don, dang tong hop can tru...`,
    );

    items = await this._loadNetOffAmounts(items);
    emitProgress(45, 'Dang tai du lieu chi nhanh...');

    const branches = await this.repository.manager.query(
      'SELECT id, name FROM erp_branches',
    );
    const branchMap: Record<string, string> = branches.reduce(
      (acc: any, curr: any) => {
        acc[curr.id] = curr.name;
        return acc;
      },
      {},
    );

    const formatTaxInvoiceStatus = (val?: number | null) => {
      switch (val) {
        case 1:
          return 'Mới';
        case 2:
          return 'Thay thế';
        case 3:
          return 'Điều chỉnh';
        case 4:
          return 'Bị thay thế';
        case 5:
          return 'Bị điều chỉnh';
        case 6:
          return 'Bị hủy';
        default:
          return val?.toString() || '—';
      }
    };

    const INVOICE_TYPE_MAP: Record<string, string> = {
      CHIET_KHAU: 'Hóa đơn chiết khấu',
      DICH_VU_CUU_HO: 'Hóa đơn cứu hộ',
      HANG_HOA: 'Hàng hóa / Vật tư',
      DICH_VU: 'Dịch vụ',
      PHI_THUE: 'Phí & Thuế',
      CUU_HO: 'Cứu hộ',
      KHAC: 'Khác',
    };

    const workbook = new ExcelJS.Workbook();

    const summaryColumns = [
      { header: 'Ngày phát hành', key: 'invoiceDate', width: 15 },
      { header: 'Ký hiệu hóa đơn', key: 'serialNo', width: 15 },
      { header: 'Số hóa đơn', key: 'invoiceNo', width: 15 },
      { header: 'Tên đơn vị khách hàng', key: 'partnerName', width: 40 },
      { header: 'MST khách hàng', key: 'taxCode', width: 15 },
      { header: 'Địa chỉ khách hàng', key: 'address', width: 50 },
      {
        header: 'Chiết khấu',
        key: 'headerDiscountAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Trước thuế GTGT',
        key: 'preVat',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Thuế suất',
        key: 'vatRate',
        width: 15,
        style: { numFmt: '0%' },
      },
      {
        header: 'Thuế GTGT',
        key: 'vat',
        width: 15,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Thành tiền',
        key: 'total',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Biển số xe', key: 'licensePlate', width: 15 },
      { header: 'Lệnh quyết toán', key: 'wo', width: 30 },
      { header: 'Diễn giải', key: 'description', width: 50 },
      { header: 'Trạng thái', key: 'statusName', width: 20 },
      { header: 'Chi nhánh', key: 'branchName', width: 25 },
      {
        header: 'Tham chiếu cấn trừ',
        key: 'netOffReferences',
        width: 25,
      },
      {
        header: 'Ngày giao dịch',
        key: 'netOffTransDate',
        width: 18,
      },
      {
        header: 'Nội dung giao dịch',
        key: 'netOffTransDesc',
        width: 45,
      },
      {
        header: 'Số tiền của tham chiếu',
        key: 'netOffRefAmount',
        width: 25,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Số tiền cấn trừ',
        key: 'netOffAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Còn lại',
        key: 'remainingAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
      },
    ];

    const detailedColumns = [
      { header: 'Ngày phát hành', key: 'invoiceDate', width: 15 },
      { header: 'Mã hàng hóa', key: 'itemCode', width: 20 },
      { header: 'Tên hàng hóa, dịch vụ', key: 'itemName', width: 40 },
      { header: 'Đơn vị tính', key: 'uom', width: 15 },
      { header: 'Ký hiệu hóa đơn', key: 'serialNo', width: 15 },
      { header: 'Số hóa đơn', key: 'invoiceNo', width: 15 },
      { header: 'Tên đơn vị khách hàng', key: 'partnerName', width: 40 },
      { header: 'MST khách hàng', key: 'taxCode', width: 15 },
      {
        header: 'Số lượng',
        key: 'qty',
        width: 15,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Đơn giá',
        key: 'unitPrice',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Trước thuế GTGT',
        key: 'preVatAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Thuế suất',
        key: 'vatRate',
        width: 15,
        style: { numFmt: '0%' },
      },
      {
        header: 'Thuế GTGT',
        key: 'vatAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Thành tiền',
        key: 'totalAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Biển số xe', key: 'licensePlate', width: 15 },
      { header: 'Lệnh quyết toán', key: 'wo', width: 30 },
      { header: 'Diễn giải', key: 'description', width: 50 },
      { header: 'Trạng thái', key: 'statusName', width: 20 },
      { header: 'Chi nhánh', key: 'branchName', width: 25 },
      { header: 'Phân loại dòng', key: 'invoiceSubcategory', width: 20 },
    ];

    const overviewColumns = [
      { header: 'Mã hàng hóa', key: 'itemCode', width: 20 },
      { header: 'Tên hàng hóa, dịch vụ', key: 'itemName', width: 45 },
      { header: 'Đơn vị tính', key: 'uom', width: 15 },
      {
        header: 'Số lượng',
        key: 'totalQty',
        width: 18,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Đơn giá bình quân',
        key: 'avgUnitPrice',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Trước thuế GTGT',
        key: 'totalPreVat',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Thuế GTGT',
        key: 'totalVat',
        width: 18,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Thành tiền',
        key: 'totalAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Số dòng',
        key: 'lineCount',
        width: 12,
        style: { numFmt: '#,##0' },
      },
    ];

    const debtColumns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Mã số thuế', key: 'taxCode', width: 18 },
      { header: 'Tên đối tác', key: 'partnerName', width: 45 },
      {
        header: 'Số lượng HĐ',
        key: 'invoiceCount',
        width: 15,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Tổng tiền hóa đơn',
        key: 'totalAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Đã cấn trừ',
        key: 'netOffAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Còn lại',
        key: 'remainingAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Lũy kế công nợ',
        key: 'cumulativeDebt',
        width: 24,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Lũy kế cấn trừ',
        key: 'cumulativeNetOff',
        width: 24,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Lũy kế còn nợ',
        key: 'cumulativeRemaining',
        width: 24,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Trạng thái', key: 'status', width: 16 },
    ];

    const applyHeaderStyle = (
      sheet: ExcelJS.Worksheet,
      sheetType: 'summary' | 'detailed' | 'overview' | 'debt' = 'detailed',
    ) => {
      sheet.getRow(1).eachCell((cell, colNumber) => {
        cell.font = { bold: true };
        if (sheetType === 'summary') {
          if (colNumber >= 17 && colNumber <= 21) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFDCEEFB' },
            };
          } else if (colNumber === 22) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFDE68A' },
            };
          } else {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE0E0E0' },
            };
          }
        } else if (sheetType === 'debt' && colNumber >= 8 && colNumber <= 10) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFDCEEFB' },
          };
        } else {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' },
          };
        }
      });
      sheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' },
      ];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columns.length },
      };
    };

    const createOverviewAccumulator =
      (map: Map<string, any>) =>
      (payload: {
        itemCode?: string;
        itemName: string;
        uom: string;
        qty: number;
        unitPrice: number;
        preVatAmount: number;
        vatAmount: number;
        totalAmount: number;
      }) => {
        const itemCode = String(payload.itemCode || '').trim();
        const itemName =
          String(payload.itemName || '').trim() || '(Không có tên)';
        const uom = String(payload.uom || '')
          .trim()
          .toUpperCase();
        const key = `${itemCode.toLowerCase()}__${itemName.toLowerCase()}__${uom.toLowerCase()}`;

        const current = map.get(key) || {
          itemCode,
          itemName,
          uom,
          totalQty: 0,
          totalPreVat: 0,
          totalVat: 0,
          totalAmount: 0,
          totalUnitPriceWeight: 0,
          lineCount: 0,
        };

        const qty = Number(payload.qty) || 0;
        const unitPrice = Number(payload.unitPrice) || 0;

        current.totalQty += qty;
        current.totalPreVat += Number(payload.preVatAmount) || 0;
        current.totalVat += Number(payload.vatAmount) || 0;
        current.totalAmount += Number(payload.totalAmount) || 0;
        current.totalUnitPriceWeight += unitPrice * qty;
        current.lineCount += 1;

        map.set(key, current);
      };

    const writeSummaryRows = (sheet: ExcelJS.Worksheet, invoiceList: any[]) => {
      for (const inv of invoiceList) {
        const partnerName =
          query.direction === 'IN' ? inv.sellerName : inv.buyerName;
        const taxCode =
          query.direction === 'IN' ? inv.sellerTaxCode : inv.buyerTaxCode;
        const address =
          query.direction === 'IN' ? inv.sellerAddress : inv.buyerAddress;
        const remainingAmount =
          Number(inv.totalAmount || 0) - Number((inv as any).netOffAmount || 0);

        const fullDesc = [
          inv.description,
          (inv as any).notes,
          ...(inv.items || []).map((i: any) => i.description),
        ]
          .filter(Boolean)
          .join(' | ');

        sheet.addRow({
          invoiceDate: inv.invoiceDate,
          serialNo: inv.serialNo,
          invoiceNo: inv.invoiceNo,
          partnerName,
          taxCode,
          address,
          headerDiscountAmount: Number(inv.discountAmount) || 0,
          preVat: Number(inv.preVatAmount) || 0,
          vatRate: parseVatRateForDisplay(inv.vatRate),
          vat: Number(inv.vatAmount) || 0,
          total: Number(inv.totalAmount) || 0,
          licensePlate: inv.licensePlate || '',
          wo: inv.settlementOrder || '',
          description: fullDesc,
          statusName: formatTaxInvoiceStatus(inv.taxInvoiceStatus),
          branchName: branchMap[inv.branchId || ''] || '',
          netOffReferences: (inv as any).netOffReferences || '',
          netOffTransDate: (inv as any).netOffTransDate || '',
          netOffTransDesc: (inv as any).netOffTransDesc || '',
          netOffRefAmount: Number((inv as any).netOffRefAmount) || 0,
          netOffAmount: Number((inv as any).netOffAmount) || 0,
          remainingAmount,
        });

        const lastSummaryRow = sheet.lastRow;
        if (lastSummaryRow) {
          for (let c = 17; c <= 21; c++) {
            const cell = lastSummaryRow.getCell(c);
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF0F9FF' },
            };
          }
          const remainingCell = lastSummaryRow.getCell(22);
          remainingCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEFCE8' },
          };
        }
      }
    };

    const writeDetailedRows = (
      sheet: ExcelJS.Worksheet,
      invoiceList: any[],
      onAccumulate?: (payload: any) => void,
    ) => {
      for (const inv of invoiceList) {
        const partnerName =
          query.direction === 'IN' ? inv.sellerName : inv.buyerName;
        const taxCode =
          query.direction === 'IN' ? inv.sellerTaxCode : inv.buyerTaxCode;
        const fullDesc = [
          inv.description,
          (inv as any).notes,
          ...(inv.items || []).map((i: any) => i.description),
        ]
          .filter(Boolean)
          .join(' | ');

        const descriptionLineCount = String(inv.description || '')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean).length;
        const invoiceLineCount = Math.max(
          inv.items?.length || 0,
          descriptionLineCount,
          1,
        );

        if (!inv.items || inv.items.length === 0) {
          const fallbackPreVat = Number(inv.preVatAmount) || 0;
          const fallbackVat = Number(inv.vatAmount) || 0;
          const fallbackTotal = Number(inv.totalAmount) || 0;
          const normalizedFallback = classifyInvoiceLine(
            {
              description: inv.description,
              unit: '',
              quantity: 0,
              unitPrice: 0,
              preVatAmount: fallbackPreVat,
              vatAmount: fallbackVat,
              totalAmount: fallbackTotal,
              discountAmount: Number(inv.discountAmount) || 0,
            },
            {
              buyerTaxCode: taxCode,
              direction: inv.direction,
              invoiceLineCount,
              taxInvoiceStatus: inv.taxInvoiceStatus,
              headerDiscountAmount: Number(inv.discountAmount) || 0,
              forReportExport: true,
            },
          );

          sheet.addRow({
            invoiceDate: inv.invoiceDate,
            itemCode: '',
            itemName: inv.description || '',
            uom: '',
            serialNo: inv.serialNo,
            invoiceNo: inv.invoiceNo,
            partnerName,
            taxCode,
            qty: normalizedFallback.quantity,
            unitPrice: normalizedFallback.unitPrice,
            preVatAmount: normalizedFallback.preVatAmount,
            vatRate: parseVatRateForDisplay(inv.vatRate),
            vatAmount: normalizedFallback.vatAmount,
            totalAmount: normalizedFallback.totalAmount,
            licensePlate: inv.licensePlate || '',
            wo: inv.settlementOrder || '',
            description: fullDesc,
            statusName: formatTaxInvoiceStatus(inv.taxInvoiceStatus),
            branchName: branchMap[inv.branchId || ''] || '',
            invoiceSubcategory:
              normalizedFallback.invoiceSubcategory === 'DISCOUNT'
                ? 'Chiết khấu'
                : normalizedFallback.invoiceSubcategory === 'RESCUE'
                  ? 'Cứu hộ'
                  : 'Thông thường',
          });

          onAccumulate?.({
            itemCode: '',
            itemName: inv.description || '',
            uom: '',
            qty: normalizedFallback.quantity,
            unitPrice: normalizedFallback.unitPrice,
            preVatAmount: normalizedFallback.preVatAmount,
            vatAmount: normalizedFallback.vatAmount,
            totalAmount: normalizedFallback.totalAmount,
          });
        } else {
          for (const item of inv.items) {
            const itemPreVat = Number(item.preVatAmount) || 0;
            const itemVatRateRaw = parseVatRateForDisplay(
              item.vatRate || inv.vatRate,
            );
            const itemVatAmount =
              Number(item.vatAmount) ||
              Math.round(itemPreVat * (Number(itemVatRateRaw) || 0));
            const itemTotalAmount =
              Number(item.totalAmount) ||
              Math.round(itemPreVat + itemVatAmount);
            const normalizedItem = classifyInvoiceLine(
              {
                description: item.description || '',
                unit: item.unit || '',
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                preVatAmount: itemPreVat,
                vatAmount: itemVatAmount,
                totalAmount: itemTotalAmount,
                discountAmount: Number(item.discountAmount) || 0,
              },
              {
                buyerTaxCode: taxCode,
                direction: inv.direction,
                invoiceLineCount,
                taxInvoiceStatus: inv.taxInvoiceStatus,
                headerDiscountAmount: Number(inv.discountAmount) || 0,
                forReportExport: true,
              },
            );

            sheet.addRow({
              invoiceDate: inv.invoiceDate,
              itemCode: item.itemCode || '',
              itemName: item.description || '',
              uom: (item.unit || '').trim().toUpperCase(),
              serialNo: inv.serialNo,
              invoiceNo: inv.invoiceNo,
              partnerName,
              taxCode,
              qty: normalizedItem.quantity,
              unitPrice: normalizedItem.unitPrice,
              preVatAmount: normalizedItem.preVatAmount,
              vatRate: itemVatRateRaw,
              vatAmount: normalizedItem.vatAmount,
              totalAmount: normalizedItem.totalAmount,
              licensePlate: inv.licensePlate || '',
              wo: inv.settlementOrder || '',
              description: fullDesc,
              statusName: formatTaxInvoiceStatus(inv.taxInvoiceStatus),
              branchName: branchMap[inv.branchId || ''] || '',
              invoiceSubcategory:
                normalizedItem.invoiceSubcategory === 'DISCOUNT'
                  ? 'Chiết khấu'
                  : normalizedItem.invoiceSubcategory === 'RESCUE'
                    ? 'Cứu hộ'
                    : 'Thông thường',
            });

            onAccumulate?.({
              itemCode: item.itemCode || '',
              itemName: item.description || '',
              uom: item.unit || '',
              qty: normalizedItem.quantity,
              unitPrice: normalizedItem.unitPrice,
              preVatAmount: normalizedItem.preVatAmount,
              vatAmount: normalizedItem.vatAmount,
              totalAmount: normalizedItem.totalAmount,
            });
          }
        }
      }
    };

    const writeOverviewRows = (
      sheet: ExcelJS.Worksheet,
      overviewMap: Map<string, any>,
    ) => {
      const overviewRows = Array.from(overviewMap.values()).sort(
        (a, b) =>
          a.itemName.localeCompare(b.itemName, 'vi') ||
          a.itemCode.localeCompare(b.itemCode, 'vi'),
      );

      for (const row of overviewRows) {
        const avgUnitPrice =
          row.totalQty > 0
            ? row.totalUnitPriceWeight / row.totalQty
            : row.lineCount > 0
              ? row.totalPreVat / row.lineCount
              : 0;

        sheet.addRow({
          itemCode: row.itemCode,
          itemName: row.itemName,
          uom: row.uom,
          totalQty: row.totalQty,
          avgUnitPrice,
          totalPreVat: row.totalPreVat,
          totalVat: row.totalVat,
          totalAmount: row.totalAmount,
          lineCount: row.lineCount,
        });
      }
    };

    // Build Cumulative map for debt
    let cutoffDate = query.date_to ? query.date_to.substring(0, 10) : '';
    if (!cutoffDate) {
      const dates = items
        .map((i) =>
          i.invoiceDate ? String(i.invoiceDate).substring(0, 10) : '',
        )
        .filter(Boolean)
        .sort();
      cutoffDate =
        dates.length > 0
          ? dates[dates.length - 1]
          : new Date().toISOString().substring(0, 10);
    }
    const effectiveCutoffDate =
      cutoffDate.length === 10 ? `${cutoffDate} 23:59:59.999` : cutoffDate;

    let cumRows: any[] = [];
    try {
      cumRows = await this.repository.manager.query(
        `
        SELECT 
          CASE 
            WHEN inv.direction = 'IN' THEN COALESCE(inv.seller_tax_code, '')
            WHEN inv.direction = 'OUT' THEN COALESCE(inv.buyer_tax_code, '')
          END as "taxCode",
          CASE 
            WHEN inv.direction = 'IN' THEN COALESCE(inv.seller_name, '')
            WHEN inv.direction = 'OUT' THEN COALESCE(inv.buyer_name, '')
          END as "partnerName",
          SUM(CAST(inv.total_amount AS NUMERIC)) as "cumTotalAmount",
          SUM(COALESCE(netoff.net_off_amount, 0)) as "cumNetOffAmount"
        FROM erp_invoices inv
        LEFT JOIN (
          SELECT invoice_id, SUM(net_off_amount) as net_off_amount
          FROM erp_invoice_voucher_netoff
          GROUP BY invoice_id
        ) netoff ON netoff.invoice_id = inv.id
        WHERE inv.is_deleted = false 
          AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
          ${query.direction ? `AND inv.direction = '${query.direction}'` : ''}
          AND inv.invoice_date <= '${effectiveCutoffDate}'
        GROUP BY 
          CASE 
            WHEN inv.direction = 'IN' THEN COALESCE(inv.seller_tax_code, '')
            WHEN inv.direction = 'OUT' THEN COALESCE(inv.buyer_tax_code, '')
          END,
          CASE 
            WHEN inv.direction = 'IN' THEN COALESCE(inv.seller_name, '')
            WHEN inv.direction = 'OUT' THEN COALESCE(inv.buyer_name, '')
          END
        `,
      );
    } catch (e) {
      cumRows = [];
    }

    const cumMap = new Map<string, { cumTotal: number; cumNetOff: number }>();
    for (const r of cumRows || []) {
      const tCode = String(r.taxCode || '').trim();
      const pName = String(r.partnerName || '').trim();
      const key = `${tCode}:::${pName}`;
      cumMap.set(key, {
        cumTotal: Number(r.cumTotalAmount) || 0,
        cumNetOff: Number(r.cumNetOffAmount) || 0,
      });
    }

    const writeDebtRows = (sheet: ExcelJS.Worksheet, invoiceList: any[]) => {
      const partnerDebtMap = new Map<
        string,
        {
          taxCode: string;
          partnerName: string;
          invoiceCount: number;
          totalAmount: number;
          netOffAmount: number;
          remainingAmount: number;
          cumulativeDebt: number;
          cumulativeNetOff: number;
          cumulativeRemaining: number;
        }
      >();

      for (const inv of invoiceList) {
        const partnerName =
          query.direction === 'IN' ? inv.sellerName : inv.buyerName;
        const taxCode =
          query.direction === 'IN' ? inv.sellerTaxCode : inv.buyerTaxCode;
        const pName = String(partnerName || '').trim() || '(Chưa có tên)';
        const tCode = String(taxCode || '').trim();
        const key = `${tCode}:::${pName}`;

        const cumData = cumMap.get(key);
        const current = partnerDebtMap.get(key) || {
          taxCode: tCode,
          partnerName: pName,
          invoiceCount: 0,
          totalAmount: 0,
          netOffAmount: 0,
          remainingAmount: 0,
          cumulativeDebt: cumData ? cumData.cumTotal : 0,
          cumulativeNetOff: cumData ? cumData.cumNetOff : 0,
          cumulativeRemaining: cumData
            ? cumData.cumTotal - cumData.cumNetOff
            : 0,
        };

        const invTotal = Number(inv.totalAmount) || 0;
        const invNetOff = Number((inv as any).netOffAmount) || 0;
        const invRemaining = invTotal - invNetOff;

        current.invoiceCount += 1;
        current.totalAmount += invTotal;
        current.netOffAmount += invNetOff;
        current.remainingAmount += invRemaining;
        if (!cumData) {
          current.cumulativeDebt += invTotal;
          current.cumulativeNetOff += invNetOff;
          current.cumulativeRemaining += invRemaining;
        }

        partnerDebtMap.set(key, current);
      }

      const partnerDebtRows = Array.from(partnerDebtMap.values()).sort(
        (a, b) =>
          b.cumulativeRemaining - a.cumulativeRemaining ||
          b.remainingAmount - a.remainingAmount ||
          a.partnerName.localeCompare(b.partnerName, 'vi'),
      );

      let stt = 1;
      let sumInvoices = 0;
      let sumTotalAmount = 0;
      let sumNetOffAmount = 0;
      let sumRemainingAmount = 0;
      let sumCumulativeDebt = 0;
      let sumCumulativeNetOff = 0;
      let sumCumulativeRemaining = 0;

      for (const row of partnerDebtRows) {
        sumInvoices += row.invoiceCount;
        sumTotalAmount += row.totalAmount;
        sumNetOffAmount += row.netOffAmount;
        sumRemainingAmount += row.remainingAmount;
        sumCumulativeDebt += row.cumulativeDebt;
        sumCumulativeNetOff += row.cumulativeNetOff;
        sumCumulativeRemaining += row.cumulativeRemaining;

        sheet.addRow({
          stt: stt++,
          taxCode: row.taxCode,
          partnerName: row.partnerName,
          invoiceCount: row.invoiceCount,
          totalAmount: row.totalAmount,
          netOffAmount: row.netOffAmount,
          remainingAmount: row.remainingAmount,
          cumulativeDebt: row.cumulativeDebt,
          cumulativeNetOff: row.cumulativeNetOff,
          cumulativeRemaining: row.cumulativeRemaining,
          status: row.cumulativeRemaining > 0 ? 'Còn nợ' : 'Đã tất toán',
        });
      }

      const debtSummaryRow = sheet.addRow({
        stt: '',
        taxCode: '',
        partnerName: 'TỔNG CỘNG',
        invoiceCount: sumInvoices,
        totalAmount: sumTotalAmount,
        netOffAmount: sumNetOffAmount,
        remainingAmount: sumRemainingAmount,
        cumulativeDebt: sumCumulativeDebt,
        cumulativeNetOff: sumCumulativeNetOff,
        cumulativeRemaining: sumCumulativeRemaining,
        status: '',
      });
      debtSummaryRow.font = { bold: true };
      debtSummaryRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE8F0FE' },
        };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'double' },
        };
      });
    };

    const isSingleInvoice = Boolean(query.id && items.length === 1);

    if (isSingleInvoice) {
      const targetInvoice = items[0];
      const partnerTaxCode =
        targetInvoice.direction === 'IN'
          ? targetInvoice.sellerTaxCode
          : targetInvoice.buyerTaxCode;
      const partnerName =
        targetInvoice.direction === 'IN'
          ? targetInvoice.sellerName
          : targetInvoice.buyerName;

      let partnerItems: any[] = items;
      try {
        const partnerQb = this.repository
          .createQueryBuilder('inv')
          .leftJoinAndSelect('inv.items', 'items')
          .where('inv.is_deleted = false')
          .andWhere('inv.direction = :dir', { dir: targetInvoice.direction });

        if (partnerTaxCode && partnerTaxCode.trim()) {
          if (targetInvoice.direction === 'IN') {
            partnerQb.andWhere('inv.seller_tax_code = :ptc', {
              ptc: partnerTaxCode.trim(),
            });
          } else {
            partnerQb.andWhere('inv.buyer_tax_code = :ptc', {
              ptc: partnerTaxCode.trim(),
            });
          }
        } else if (partnerName && partnerName.trim()) {
          if (targetInvoice.direction === 'IN') {
            partnerQb.andWhere('inv.seller_name = :pname', {
              pname: partnerName.trim(),
            });
          } else {
            partnerQb.andWhere('inv.buyer_name = :pname', {
              pname: partnerName.trim(),
            });
          }
        }

        partnerQb
          .orderBy('inv.invoiceDate', 'DESC')
          .addOrderBy('inv.createdAt', 'DESC');
        partnerItems = await partnerQb.getMany();
        partnerItems = await this._loadNetOffAmounts(partnerItems);
      } catch (err: any) {
        this.logger.warn(
          `Failed to load partner invoices for export: ${err?.message}`,
        );
        partnerItems = items;
      }

      // 1. Sheet: Chi tiết HĐ (chỉ dữ liệu hóa đơn này)
      const singleSummarySheet = workbook.addWorksheet('Chi tiết HĐ');
      singleSummarySheet.columns = summaryColumns;
      applyHeaderStyle(singleSummarySheet, 'summary');
      writeSummaryRows(singleSummarySheet, items);

      // 2. Sheet: Bảng kê HHDV HĐ (chỉ hàng hóa của hóa đơn này)
      const singleDetailedSheet = workbook.addWorksheet('Bảng kê HHDV HĐ');
      singleDetailedSheet.columns = detailedColumns;
      applyHeaderStyle(singleDetailedSheet, 'detailed');
      writeDetailedRows(singleDetailedSheet, items);

      // 3. Sheet: Bảng kê đối tác (tổng hợp toàn bộ hóa đơn của đối tượng đó)
      const partnerSummarySheet = workbook.addWorksheet('Bảng kê đối tác');
      partnerSummarySheet.columns = summaryColumns;
      applyHeaderStyle(partnerSummarySheet, 'summary');
      writeSummaryRows(partnerSummarySheet, partnerItems);

      // 4. Sheet: Tổng quan HHDV đối tác (đặt trước Bảng kê HHDV)
      const partnerOverviewSheet = workbook.addWorksheet(
        'Tổng quan HHDV đối tác',
      );
      partnerOverviewSheet.columns = overviewColumns;
      applyHeaderStyle(partnerOverviewSheet, 'overview');

      // 5. Sheet: Bảng kê HHDV đối tác (toàn bộ hàng hóa của đối tượng đó)
      const partnerDetailedSheet = workbook.addWorksheet(
        'Bảng kê HHDV đối tác',
      );
      partnerDetailedSheet.columns = detailedColumns;
      applyHeaderStyle(partnerDetailedSheet, 'detailed');

      const partnerOverviewMap = new Map<string, any>();
      writeDetailedRows(partnerDetailedSheet, partnerItems, (p) =>
        createOverviewAccumulator(partnerOverviewMap)(p),
      );
      writeOverviewRows(partnerOverviewSheet, partnerOverviewMap);

      // 6. Sheet: Công nợ đối tác
      const partnerDebtSheet = workbook.addWorksheet('Công nợ đối tác');
      partnerDebtSheet.columns = debtColumns;
      applyHeaderStyle(partnerDebtSheet, 'debt');
      writeDebtRows(partnerDebtSheet, partnerItems);
    } else {
      // 1. Sheet: Bảng kê
      const summarySheet = workbook.addWorksheet('Bảng kê');
      summarySheet.columns = summaryColumns;
      applyHeaderStyle(summarySheet, 'summary');
      writeSummaryRows(summarySheet, items);

      // 2. Sheet: Tổng quan HHDV (đặt trước Bảng kê HHDV)
      const overviewSheet = workbook.addWorksheet('Tổng quan HHDV');
      overviewSheet.columns = overviewColumns;
      applyHeaderStyle(overviewSheet, 'overview');

      // 3. Sheet: Bảng kê HHDV
      const detailedSheet = workbook.addWorksheet('Bảng kê HHDV');
      detailedSheet.columns = detailedColumns;
      applyHeaderStyle(detailedSheet, 'detailed');

      const overviewMap = new Map<string, any>();
      writeDetailedRows(detailedSheet, items, (p) =>
        createOverviewAccumulator(overviewMap)(p),
      );
      writeOverviewRows(overviewSheet, overviewMap);

      // 4. Sheet: Công nợ theo đối tượng
      const debtSheet = workbook.addWorksheet('Công nợ theo đối tượng');
      debtSheet.columns = debtColumns;
      applyHeaderStyle(debtSheet, 'debt');
      writeDebtRows(debtSheet, items);
    }

    emitProgress(97, 'Dang dong goi file XLSX...');
    const buffer = await workbook.xlsx.writeBuffer();
    emitProgress(100, 'Da tao xong file XLSX');
    return buffer as any;
  }

  async getBulkNetOffs(invoiceIds: string[]) {
    if (!invoiceIds || invoiceIds.length === 0) return [];

    return this.repository.manager
      .createQueryBuilder('erp_invoice_voucher_netoff', 'netoff')
      .leftJoinAndSelect('netoff.bankTransaction', 'txn')
      .where('netoff.invoice_id IN (:...invoiceIds)', { invoiceIds })
      .getMany();
  }

  async getStats(direction?: 'IN' | 'OUT', dateFrom?: string, dateTo?: string) {
    const today = new Date();

    // Compute sixMonthsAgo as YYYY-MM-DD string
    let smYear = today.getFullYear();
    let smMonth = today.getMonth() - 5;
    if (smMonth < 0) {
      smMonth += 12;
      smYear -= 1;
    }
    const sixMonthsAgoStr = `${smYear}-${String(smMonth + 1).padStart(2, '0')}-01`;

    const qb = this.repository.createQueryBuilder('inv');
    qb.where('inv.is_deleted = false');
    if (direction) {
      qb.andWhere('inv.direction = :direction', { direction });
    }
    qb.andWhere(
      '(inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)',
    );
    // Use string comparison for exact match based on database Date
    let fetchFrom = sixMonthsAgoStr;
    if (dateFrom && dateFrom < fetchFrom) {
      fetchFrom = dateFrom;
    }
    qb.andWhere(`TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') >= :fetchFrom`, {
      fetchFrom,
    });

    qb.leftJoin('erp_branches', 'b', 'b.id = inv.branch_id');
    qb.select(`TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')`, 'day_date');
    qb.addSelect(`inv.branch_id`, 'branch_id');
    qb.addSelect(`b.name`, 'branch_name');
    qb.addSelect(`SUM(inv.total_amount)`, 'total_amount');
    qb.addSelect(`SUM(inv.pre_vat_amount)`, 'pre_vat_amount');
    qb.groupBy(`TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')`);
    qb.addGroupBy(`inv.branch_id`);
    qb.addGroupBy(`b.name`);
    qb.orderBy(`TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')`, 'ASC');

    const records = await qb.getRawMany();

    let monthTotal = 0,
      monthPreVat = 0;
    let weekTotal = 0,
      weekPreVat = 0;
    let dayTotal = 0,
      dayPreVat = 0;

    const monthChart = Array(6).fill(0);
    const weekChart = Array(4).fill(0);
    const dayChart = Array(7).fill(0);

    const monthPreVatChart = Array(6).fill(0);
    const weekPreVatChart = Array(4).fill(0);
    const dayPreVatChart = Array(7).fill(0);

    const byBranchMap = new Map<string, any>();
    const getBranchKey = (name: string | null) => {
      if (name?.toLowerCase().includes('đào trí')) return 'dao_tri';
      if (name?.toLowerCase().includes('phổ quang')) return 'pho_quang';
      return 'other';
    };
    const getBranchLabel = (key: string) => {
      if (key === 'dao_tri') return 'Đào Trí';
      if (key === 'pho_quang') return 'Phổ Quang';
      return 'Còn lại';
    };
    const getBranchStats = (key: string) => {
      if (!byBranchMap.has(key)) {
        byBranchMap.set(key, {
          branchName: getBranchLabel(key),
          monthTotal: 0,
          monthPreVat: 0,
          weekTotal: 0,
          weekPreVat: 0,
          dayTotal: 0,
          dayPreVat: 0,
        });
      }
      return byBranchMap.get(key)!;
    };

    // Helpers to get start of current periods as YYYY-MM-DD strings
    const pad = (n: number) => String(n).padStart(2, '0');

    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
      today.getDate(),
    )}`;

    const thisMonthStr = `${today.getFullYear()}-${pad(
      today.getMonth() + 1,
    )}-01`;

    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(
      today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1),
    ); // Monday
    const thisWeekStr = `${startOfThisWeek.getFullYear()}-${pad(
      startOfThisWeek.getMonth() + 1,
    )}-${pad(startOfThisWeek.getDate())}`;

    // Helper to calculate diff in days between two YYYY-MM-DD strings
    const diffDays = (d1Str: string, d2Str: string) => {
      // Create local mid-day dates to avoid DST/timezone issues when computing diffs
      const [y1, m1, d1] = d1Str.split('-').map(Number);
      const [y2, m2, d2] = d2Str.split('-').map(Number);
      const date1 = new Date(y1, m1 - 1, d1, 12, 0, 0);
      const date2 = new Date(y2, m2 - 1, d2, 12, 0, 0);
      return Math.round(
        (date1.getTime() - date2.getTime()) / (1000 * 3600 * 24),
      );
    };

    for (const row of records) {
      const dStr = row.day_date; // string like '2026-06-01'
      const total = Number(row.total_amount) || 0;
      const prevat = Number(row.pre_vat_amount) || 0;
      const branchKey = getBranchKey(row.branch_name);
      const bStats = getBranchStats(branchKey);

      // If dateFrom and dateTo are provided, use them for totals instead of current periods
      if (dateFrom && dateTo) {
        if (dStr >= dateFrom && dStr <= dateTo) {
          monthTotal += total;
          monthPreVat += prevat;
          bStats.monthTotal += total;
          bStats.monthPreVat += prevat;

          weekTotal += total;
          weekPreVat += prevat;
          bStats.weekTotal += total;
          bStats.weekPreVat += prevat;

          dayTotal += total;
          dayPreVat += prevat;
          bStats.dayTotal += total;
          bStats.dayPreVat += prevat;
        }
      } else {
        // Current Day
        if (dStr === todayStr) {
          dayTotal += total;
          dayPreVat += prevat;
          bStats.dayTotal += total;
          bStats.dayPreVat += prevat;
        }

        // Current Week
        if (dStr >= thisWeekStr) {
          weekTotal += total;
          weekPreVat += prevat;
          bStats.weekTotal += total;
          bStats.weekPreVat += prevat;
        }

        // Current Month
        if (dStr >= thisMonthStr) {
          monthTotal += total;
          monthPreVat += prevat;
          bStats.monthTotal += total;
          bStats.monthPreVat += prevat;
        }
      }

      // Day Chart (last 7 days, index 6 is today, 0 is 6 days ago)
      const dDays = diffDays(todayStr, dStr);
      if (dDays >= 0 && dDays < 7) {
        dayChart[6 - dDays] += total;
        dayPreVatChart[6 - dDays] += prevat;
      }

      // Week Chart (last 4 weeks, index 3 is this week, 0 is 3 weeks ago)
      let weekIndex = 3;
      if (dStr < thisWeekStr) {
        const dWeeks = Math.ceil(diffDays(thisWeekStr, dStr) / 7);
        weekIndex = 3 - dWeeks;
      }
      if (weekIndex >= 0 && weekIndex < 4) {
        weekChart[weekIndex] += total;
        weekPreVatChart[weekIndex] += prevat;
      }

      // Month Chart (last 6 months, index 5 is this month, 0 is 5 months ago)
      let monthIndex = 5;
      if (dStr < thisMonthStr) {
        // compute diff in months
        const [y1, m1] = thisMonthStr.split('-').map(Number);
        const [y2, m2] = dStr.split('-').map(Number);
        const dMonths = (y1 - y2) * 12 + (m1 - m2);
        monthIndex = 5 - dMonths;
      }
      if (monthIndex >= 0 && monthIndex < 6) {
        monthChart[monthIndex] += total;
        monthPreVatChart[monthIndex] += prevat;
      }
    }

    const byBranch = Array.from(byBranchMap.values());
    byBranch.sort((a: any, b: any) => {
      const order: Record<string, number> = {
        'Đào Trí': 1,
        'Phổ Quang': 2,
        'Còn lại': 3,
      };
      return (order[a.branchName] || 99) - (order[b.branchName] || 99);
    });

    return {
      monthTotal,
      monthPreVat,
      monthChart,
      monthPreVatChart,
      weekTotal,
      weekPreVat,
      weekChart,
      weekPreVatChart,
      dayTotal,
      dayPreVat,
      dayChart,
      dayPreVatChart,
      byBranch,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async _loadNetOffAmounts(invoices: ErpInvoice[]) {
    if (invoices.length === 0) return invoices;
    const ids = invoices.map((i) => i.id);
    const qb = this.repository.manager
      .createQueryBuilder('erp_invoice_voucher_netoff', 'netoff')
      .select('netoff.invoice_id', 'invoiceId')
      .addSelect('netoff.net_off_amount', 'netOffAmount')
      .addSelect('bt.reference_number', 'refNo')
      .addSelect('bt.trans_date', 'transDate')
      .addSelect('bt.description', 'description')
      .addSelect('bt.accounting_description', 'accountingDescription')
      .addSelect('bt.debit_amount', 'debitAmount')
      .addSelect('bt.credit_amount', 'creditAmount')
      .leftJoin(
        'erp_bank_transactions',
        'bt',
        'bt.id = netoff.bank_transaction_id',
      )
      .where('netoff.invoice_id IN (:...ids)', { ids });

    if (typeof (qb as any).orderBy === 'function') {
      (qb as any).orderBy('bt.trans_date', 'ASC');
    }
    if (typeof (qb as any).addOrderBy === 'function') {
      (qb as any).addOrderBy('netoff.created_at', 'ASC');
    }

    const rawRows = (await qb.getRawMany()) || [];

    const netOffMap: Record<
      string,
      {
        sum: number;
        refNos: string[];
        transDates: string[];
        descriptions: string[];
        refAmounts: number[];
        details: Array<{
          refNo: string;
          transDate: string;
          description: string;
          refAmount: number;
          netOffAmount: number;
        }>;
      }
    > = {};

    for (const row of rawRows) {
      const invId = row.invoiceId;
      if (!netOffMap[invId]) {
        netOffMap[invId] = {
          sum: 0,
          refNos: [],
          transDates: [],
          descriptions: [],
          refAmounts: [],
          details: [],
        };
      }

      const netOffAmt = Number(row.netOffAmount ?? row.sum) || 0;
      const debitAmt = Number(row.debitAmount) || 0;
      const creditAmt = Number(row.creditAmount) || 0;
      const refAmt = debitAmt > 0 ? debitAmt : creditAmt;

      const refNo = row.refNo
        ? String(row.refNo).trim()
        : row.refNos
          ? String(row.refNos).trim()
          : '';
      let transDateStr = '';
      if (row.transDate) {
        if (typeof row.transDate === 'string') {
          transDateStr = row.transDate.substring(0, 10);
        } else if (row.transDate instanceof Date) {
          const y = row.transDate.getFullYear();
          const m = String(row.transDate.getMonth() + 1).padStart(2, '0');
          const d = String(row.transDate.getDate()).padStart(2, '0');
          transDateStr = `${y}-${m}-${d}`;
        }
      }

      const desc = (row.accountingDescription || row.description || '')
        .toString()
        .trim();

      netOffMap[invId].sum += netOffAmt;
      if (refNo && !netOffMap[invId].refNos.includes(refNo)) {
        netOffMap[invId].refNos.push(refNo);
      }
      if (transDateStr && !netOffMap[invId].transDates.includes(transDateStr)) {
        netOffMap[invId].transDates.push(transDateStr);
      }
      if (desc && !netOffMap[invId].descriptions.includes(desc)) {
        netOffMap[invId].descriptions.push(desc);
      }
      if (refAmt > 0 && !netOffMap[invId].refAmounts.includes(refAmt)) {
        netOffMap[invId].refAmounts.push(refAmt);
      }

      netOffMap[invId].details.push({
        refNo,
        transDate: transDateStr,
        description: desc,
        refAmount: refAmt,
        netOffAmount: netOffAmt,
      });
    }

    return invoices.map((i) => {
      const data = netOffMap[i.id];
      return {
        ...i,
        netOffAmount: String(data?.sum || 0),
        netOffReferences: (data?.refNos || []).join(', '),
        netOffTransDate: (data?.transDates || []).join(', '),
        netOffTransDesc: (data?.descriptions || []).join(' | '),
        netOffRefAmount:
          data?.refAmounts && data.refAmounts.length > 0
            ? data.refAmounts.length === 1
              ? data.refAmounts[0]
              : data.refAmounts.reduce((a, b) => a + b, 0)
            : 0,
        netOffDetails: data?.details || [],
      };
    });
  }

  private _mapSortByToQbColumn(
    sortBy: string,
    direction?: string,
  ): string | null {
    const map: Record<string, string> = {
      invoiceNo: 'inv.invoiceNo',
      totalAmount: 'inv.totalAmount',
      sellerName: 'inv.sellerName',
      buyerName: 'inv.buyerName',
      status: 'inv.status',
      invoiceDate: 'inv.invoiceDate',
      serialNo: 'inv.serialNo',
      description: 'inv.description',
      preVatAmount: 'inv.preVatAmount',
      vatRate: 'inv.vatRate',
      vatAmount: 'inv.vatAmount',
      discountAmount: 'inv.discountAmount',
      licensePlate: 'inv.licensePlate',
      settlementOrder: 'inv.settlementOrder',
      branchId: 'inv.branchId',
      netOffAmount: 'COALESCE(netoff_agg.net_off_sum, 0)',
      remainingAmount:
        '(inv.total_amount - COALESCE(netoff_agg.net_off_sum, 0))',
    };
    if (sortBy === 'partner')
      return direction === 'IN' ? 'inv.sellerName' : 'inv.buyerName';
    if (sortBy === 'taxCode')
      return direction === 'IN' ? 'inv.sellerTaxCode' : 'inv.buyerTaxCode';
    return map[sortBy] ?? null;
  }

  private _applyColumnSearch(
    qb: any,
    columnSearch: Record<string, string>,
    direction?: string,
  ) {
    Object.keys(columnSearch).forEach((key) => {
      const val = columnSearch[key];
      if (!val) return;

      if (key === 'invoiceNo') {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['inv.invoice_no', 'inv.serial_no'],
          val,
          'invoiceNoSearch',
        );
      } else if (key === 'serialNo') {
        applyMultiKeywordFilter(qb, 'inv.serial_no', val, 'serialNoSearch');
      } else if (key === 'partner') {
        if (direction === 'IN') {
          applyMultiKeywordMultiFieldFilter(
            qb,
            ['inv.seller_name', 'inv.seller_tax_code'],
            val,
            'partnerSearch',
          );
        } else if (direction === 'OUT') {
          applyMultiKeywordMultiFieldFilter(
            qb,
            ['inv.buyer_name', 'inv.buyer_personal_name', 'inv.buyer_tax_code'],
            val,
            'partnerSearch',
          );
        } else {
          applyMultiKeywordMultiFieldFilter(
            qb,
            [
              'inv.seller_name',
              'inv.seller_tax_code',
              'inv.buyer_name',
              'inv.buyer_personal_name',
              'inv.buyer_tax_code',
            ],
            val,
            'partnerSearch',
          );
        }
      } else if (key === 'taxCode') {
        if (direction === 'IN') {
          applyMultiKeywordFilter(
            qb,
            'inv.seller_tax_code',
            val,
            'taxCodeSearch',
          );
        } else if (direction === 'OUT') {
          applyMultiKeywordFilter(
            qb,
            'inv.buyer_tax_code',
            val,
            'taxCodeSearch',
          );
        } else {
          applyMultiKeywordMultiFieldFilter(
            qb,
            ['inv.seller_tax_code', 'inv.buyer_tax_code'],
            val,
            'taxCodeSearch',
          );
        }
      } else if (key === 'description') {
        applyMultiKeywordFilter(qb, 'inv.description', val, 'descSearch');
      } else if (key === 'preVatAmount') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(inv.pre_vat_amount AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'preVatSearch',
        );
      } else if (key === 'vatRate') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(inv.vat_rate AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'vatRateSearch',
        );
      } else if (key === 'vatAmount') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(inv.vat_amount AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'vatSearch',
        );
      } else if (key === 'discountAmount') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(inv.discount_amount AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'discountSearch',
        );
      } else if (key === 'totalAmount') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(inv.total_amount AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'totalSearch',
        );
      } else if (key === 'netOffAmount') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(COALESCE(netoff_agg.net_off_sum, 0) AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'netOffSearch',
        );
      } else if (key === 'remainingAmount') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST((inv.total_amount - COALESCE(netoff_agg.net_off_sum, 0)) AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'remainingSearch',
        );
      } else if (key === 'settlementOrder') {
        applyMultiKeywordFilter(
          qb,
          'inv.settlement_order',
          val,
          'settlementSearch',
        );
      } else if (key === 'licensePlate') {
        applyMultiKeywordFilter(qb, 'inv.license_plate', val, 'plateSearch');
      } else if (key === 'notes') {
        applyMultiKeywordFilter(qb, 'inv.notes', val, 'notesSearch');
      } else if (key === 'branchId' || key === 'branchName') {
        applyMultiKeywordFilter(qb, 'inv.branch_id', val, 'branchIdSearch');
      } else if (key === 'status') {
        applyMultiKeywordFilter(qb, 'inv.status', val, 'statusSearch');
      } else if (key === 'postingStatus') {
        applyMultiKeywordFilter(
          qb,
          'inv.posting_status',
          val,
          'postingStatusSearch',
        );
      } else if (key === 'taxInvoiceStatus') {
        applyMultiKeywordFilter(
          qb,
          'CAST(inv.tax_invoice_status AS TEXT)',
          val,
          'taxInvoiceStatusSearch',
        );
      } else if (key === 'invoiceDate') {
        const rawKw = String(val);
        if (rawKw.includes('|')) {
          const [from, to] = rawKw.split('|');
          if (from && to) {
            qb.andWhere(
              `inv.invoice_date >= :from_invDate AND inv.invoice_date <= :to_invDate`,
              { from_invDate: from, to_invDate: to + ' 23:59:59' },
            );
          } else if (from) {
            qb.andWhere(`inv.invoice_date >= :from_invDate`, {
              from_invDate: from,
            });
          } else if (to) {
            qb.andWhere(`inv.invoice_date <= :to_invDate`, {
              to_invDate: to + ' 23:59:59',
            });
          }
        } else {
          applyMultiKeywordFilter(
            qb,
            "TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')",
            val,
            'invoiceDateSearch',
          );
        }
      }
    });
  }

  private _applyColumnFilters(
    qb: any,
    columnFilters: Record<string, string[]>,
    direction?: string,
  ) {
    Object.keys(columnFilters).forEach((key) => {
      const vals = columnFilters[key];
      if (!vals || vals.length === 0) return;

      if (vals[0] === '__ALL_MATCHING__') {
        const searchStr = vals[1] || '';
        if (searchStr) {
          this._applyColumnSearch(qb, { [key]: searchStr }, direction);
        }
        return;
      }

      if (key === 'status')
        qb.andWhere('inv.status IN (:...statusVals)', { statusVals: vals });
      else if (key === 'postingStatus')
        qb.andWhere('inv.posting_status IN (:...postingStatusVals)', {
          postingStatusVals: vals,
        });
      else if (key === 'branchId') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        if (hasBlank && realVals.length > 0) {
          qb.andWhere(
            '(inv.branch_id IN (:...branchVals) OR inv.branch_id IS NULL)',
            { branchVals: realVals },
          );
        } else if (hasBlank) {
          qb.andWhere('(inv.branch_id IS NULL)');
        } else {
          qb.andWhere('inv.branch_id IN (:...branchVals)', {
            branchVals: vals,
          });
        }
      } else if (key === 'invoiceDate')
        qb.andWhere(
          `TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') IN (:...invoiceDateVals)`,
          { invoiceDateVals: vals },
        );
      else if (key === 'serialNo')
        qb.andWhere('inv.serial_no IN (:...serialNoVals)', {
          serialNoVals: vals,
        });
      else if (key === 'invoiceNo') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        const conds: string[] = [];
        const params: Record<string, any> = {};
        const simpleVals: string[] = [];

        realVals.forEach((v, idx) => {
          if (v.includes(':::')) {
            const [invNo, serNo] = v.split(':::');
            conds.push(
              `(TRIM(inv.invoice_no) = :invNo_${idx} AND TRIM(inv.serial_no) = :serNo_${idx})`,
            );
            params[`invNo_${idx}`] = invNo.trim();
            params[`serNo_${idx}`] = serNo.trim();
          } else {
            simpleVals.push(v.trim());
          }
        });

        if (simpleVals.length > 0) {
          conds.push(
            '(TRIM(inv.invoice_no) IN (:...simpleInvoiceNos) OR TRIM(inv.serial_no) IN (:...simpleInvoiceNos))',
          );
          params['simpleInvoiceNos'] = simpleVals;
        }

        if (hasBlank) {
          conds.push(
            "(inv.invoice_no IS NULL OR CAST(inv.invoice_no AS TEXT) = '')",
          );
        }

        if (conds.length > 0) {
          qb.andWhere(`(${conds.join(' OR ')})`, params);
        }
      } else if (key === 'partner') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        const nameField =
          direction === 'IN'
            ? 'inv.seller_name'
            : direction === 'OUT'
              ? "COALESCE(NULLIF(inv.buyer_name, ''), inv.buyer_personal_name)"
              : "(CASE WHEN inv.direction = 'IN' THEN inv.seller_name ELSE COALESCE(NULLIF(inv.buyer_name, ''), inv.buyer_personal_name) END)";
        const taxField =
          direction === 'IN'
            ? 'inv.seller_tax_code'
            : direction === 'OUT'
              ? 'inv.buyer_tax_code'
              : "(CASE WHEN inv.direction = 'IN' THEN inv.seller_tax_code ELSE inv.buyer_tax_code END)";

        const conds: string[] = [];
        const params: Record<string, any> = {};
        const simpleVals: string[] = [];

        realVals.forEach((v, idx) => {
          if (v.includes(':::')) {
            const [tax, name] = v.split(':::');
            if (tax && name) {
              conds.push(
                `(TRIM(${taxField}) = :partnerTax_${idx} OR TRIM(${nameField}) ILIKE :partnerName_${idx})`,
              );
              params[`partnerTax_${idx}`] = tax.trim();
              params[`partnerName_${idx}`] = `%${name.trim()}%`;
            } else if (tax) {
              conds.push(`TRIM(${taxField}) = :partnerTax_${idx}`);
              params[`partnerTax_${idx}`] = tax.trim();
            } else if (name) {
              conds.push(`TRIM(${nameField}) ILIKE :partnerName_${idx}`);
              params[`partnerName_${idx}`] = `%${name.trim()}%`;
            }
          } else {
            simpleVals.push(v.trim());
          }
        });

        if (simpleVals.length > 0) {
          conds.push(
            `(TRIM(${nameField}) IN (:...simplePartners) OR TRIM(${taxField}) IN (:...simplePartners))`,
          );
          params['simplePartners'] = simpleVals;
        }

        if (hasBlank) {
          conds.push(
            `(${nameField} IS NULL OR CAST(${nameField} AS TEXT) = '')`,
          );
        }

        if (conds.length > 0) {
          qb.andWhere(`(${conds.join(' OR ')})`, params);
        }
      } else if (key === 'taxCode') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        const fieldMap: any = {
          IN: 'inv.seller_tax_code',
          OUT: 'inv.buyer_tax_code',
        };
        const field = direction
          ? fieldMap[direction]
          : "(CASE WHEN inv.direction = 'IN' THEN inv.seller_tax_code WHEN inv.direction = 'OUT' THEN inv.buyer_tax_code END)";

        if (hasBlank && realVals.length > 0) {
          qb.andWhere(
            `(${field} IN (:...taxCodeVals) OR ${field} IS NULL OR CAST(${field} AS TEXT) = '')`,
            { taxCodeVals: realVals },
          );
        } else if (hasBlank) {
          qb.andWhere(`(${field} IS NULL OR CAST(${field} AS TEXT) = '')`);
        } else {
          qb.andWhere(`${field} IN (:...taxCodeVals)`, { taxCodeVals: vals });
        }
      } else if (key === 'description') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        if (hasBlank && realVals.length > 0) {
          qb.andWhere(
            "(inv.description IN (:...descVals) OR inv.description IS NULL OR inv.description = '')",
            { descVals: realVals },
          );
        } else if (hasBlank) {
          qb.andWhere("(inv.description IS NULL OR inv.description = '')");
        } else {
          qb.andWhere('inv.description IN (:...descVals)', { descVals: vals });
        }
      } else if (key === 'notes') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        if (hasBlank && realVals.length > 0) {
          qb.andWhere(
            "(inv.notes IN (:...notesVals) OR inv.notes IS NULL OR inv.notes = '')",
            { notesVals: realVals },
          );
        } else if (hasBlank) {
          qb.andWhere("(inv.notes IS NULL OR inv.notes = '')");
        } else {
          qb.andWhere('inv.notes IN (:...notesVals)', { notesVals: vals });
        }
      } else if (key === 'isValid') {
        const validFilter = vals.includes('true') || vals.includes('1');
        const invalidFilter = vals.includes('false') || vals.includes('0');
        if (validFilter && !invalidFilter) qb.andWhere('inv.is_valid = true');
        else if (invalidFilter && !validFilter)
          qb.andWhere('inv.is_valid = false');
      } else if (key === 'preVatAmount') {
        qb.andWhere('CAST(inv.pre_vat_amount AS TEXT) IN (:...preVatVals)', {
          preVatVals: vals,
        });
      } else if (key === 'vatRate') {
        qb.andWhere('CAST(inv.vat_rate AS TEXT) IN (:...vatRateVals)', {
          vatRateVals: vals,
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
      } else if (key === 'settlementOrder')
        qb.andWhere('inv.settlement_order IN (:...settleVals)', {
          settleVals: vals,
        });
      else if (key === 'licensePlate')
        qb.andWhere('inv.license_plate IN (:...plateVals)', {
          plateVals: vals,
        });
      else if (key === 'attachments') {
        const conditions: string[] = [];
        if (vals.includes('has_pdf'))
          conditions.push(
            "(inv.pdf_file_key IS NOT NULL OR (inv.pdf_files IS NOT NULL AND inv.pdf_files::text != '[]' AND inv.pdf_files::text != 'null') OR EXISTS (SELECT 1 FROM erp_invoice_attachments eia JOIN erp_attachments ea ON eia.attachment_id = ea.id WHERE eia.invoice_id = inv.id AND ea.mime_type = 'application/pdf'))",
          );
        if (vals.includes('has_xml'))
          conditions.push('inv.xml_file_key IS NOT NULL');
        if (vals.includes('no_pdf'))
          conditions.push(
            "(inv.pdf_file_key IS NULL AND (inv.pdf_files IS NULL OR inv.pdf_files::text = '[]' OR inv.pdf_files::text = 'null') AND NOT EXISTS (SELECT 1 FROM erp_invoice_attachments eia JOIN erp_attachments ea ON eia.attachment_id = ea.id WHERE eia.invoice_id = inv.id AND ea.mime_type = 'application/pdf'))",
          );
        if (vals.includes('no_xml'))
          conditions.push('inv.xml_file_key IS NULL');
        if (conditions.length > 0) qb.andWhere(`(${conditions.join(' OR ')})`);
      } else if (key === 'taxInvoiceType')
        qb.andWhere('inv.tax_invoice_type IN (:...taxInvoiceTypeVals)', {
          taxInvoiceTypeVals: vals,
        });
      else if (key === 'taxInvoiceStatus') {
        const numericVals = vals
          .map((v) => parseInt(v, 10))
          .filter((v) => !isNaN(v));
        const includeNull = vals.includes('null') || vals.includes('NULL');
        if (numericVals.length > 0 && includeNull) {
          qb.andWhere(
            '(inv.tax_invoice_status IN (:...taxInvoiceStatusVals) OR inv.tax_invoice_status IS NULL)',
            { taxInvoiceStatusVals: numericVals },
          );
        } else if (numericVals.length > 0) {
          qb.andWhere('inv.tax_invoice_status IN (:...taxInvoiceStatusVals)', {
            taxInvoiceStatusVals: numericVals,
          });
        } else if (includeNull) {
          qb.andWhere('inv.tax_invoice_status IS NULL');
        }
      } else if (key === 'taxProcessStatus') {
        qb.andWhere('inv.tax_process_status IN (:...taxProcessStatusVals)', {
          taxProcessStatusVals: vals
            .map((v) => parseInt(v, 10))
            .filter((v) => !isNaN(v)),
        });
      } else if (key === 'relatedInvoiceNo' || key === 'related_invoice_no') {
        qb.andWhere('inv.related_invoice_no IN (:...relInvNoVals)', {
          relInvNoVals: vals,
        });
      } else if (key === 'relatedSerialNo' || key === 'related_serial_no') {
        qb.andWhere('inv.related_serial_no IN (:...relSerialNoVals)', {
          relSerialNoVals: vals,
        });
      } else if (key === 'netOffAmount' || key === 'remainingAmount') {
        const conditions: string[] = [];
        if (vals.includes('settled_full'))
          conditions.push(
            '(COALESCE(netoff_agg.net_off_sum, 0) > 0 AND inv.total_amount <= COALESCE(netoff_agg.net_off_sum, 0))',
          );
        if (vals.includes('settled_partial'))
          conditions.push(
            '(COALESCE(netoff_agg.net_off_sum, 0) > 0 AND inv.total_amount > COALESCE(netoff_agg.net_off_sum, 0))',
          );
        if (vals.includes('unsettled'))
          conditions.push('(COALESCE(netoff_agg.net_off_sum, 0) = 0)');

        if (conditions.length > 0) qb.andWhere(`(${conditions.join(' OR ')})`);
      }
    });
  }

  private _applyColumnFiltersExport(
    qb: any,
    columnFilters: Record<string, string[]>,
    direction?: string,
  ) {
    // Export uses same filter logic as findAll
    this._applyColumnFilters(qb, columnFilters, direction);
  }

  // ---------------------------------------------------------------------------
  // Invoice Items Query & Column Options
  // ---------------------------------------------------------------------------

  async findAllItems(query: ErpInvoiceItemQuery) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 50;

    const itemRepo =
      this.itemRepository ||
      this.repository.manager.getRepository(ErpInvoiceItem);

    const qb = itemRepo
      .createQueryBuilder('ii')
      .innerJoin(ErpInvoice, 'inv', 'inv.id = ii.invoice_id')
      .leftJoin('erp_branches', 'b', 'b.id = inv.branch_id')
      .where('inv.is_deleted = false');

    if (query.direction) {
      qb.andWhere('inv.direction = :direction', { direction: query.direction });
    }

    if (query.status) {
      qb.andWhere('inv.status = :status', { status: query.status });
    }

    if (query.posting_status) {
      qb.andWhere('inv.posting_status = :postingStatus', {
        postingStatus: query.posting_status,
      });
    }

    if (query.invoice_subcategory) {
      qb.andWhere('ii.invoice_subcategory = :subcat', {
        subcat: query.invoice_subcategory,
      });
    }

    if (query.date_from) {
      qb.andWhere('inv.invoice_date >= :dateFrom', {
        dateFrom: query.date_from,
      });
    }

    if (query.date_to) {
      const effectiveDateTo =
        query.date_to.length === 10
          ? `${query.date_to} 23:59:59.999`
          : query.date_to;
      qb.andWhere('inv.invoice_date <= :dateTo', { dateTo: effectiveDateTo });
    }

    if (query.tag_id) {
      qb.andWhere(
        `inv.id IN (SELECT entity_id FROM sys_entity_tags WHERE entity_type = 'erp_invoice' AND tag_id = :tagId)`,
        { tagId: query.tag_id },
      );
    }

    if (query.seller_name) {
      qb.andWhere('inv.seller_name ILIKE :sellerName', {
        sellerName: `%${query.seller_name.trim()}%`,
      });
    }

    if (query.buyer_name) {
      qb.andWhere(
        '(inv.buyer_name ILIKE :buyerName OR inv.buyer_personal_name ILIKE :buyerName)',
        {
          buyerName: `%${query.buyer_name.trim()}%`,
        },
      );
    }

    // Filter by partner tax code (seller or buyer depending on direction)
    if (query.partner_tax_code) {
      qb.andWhere('(inv.seller_tax_code = :ptc OR inv.buyer_tax_code = :ptc)', {
        ptc: query.partner_tax_code.trim(),
      });
    }

    // Global Search
    if (query.search) {
      const q = `%${query.search.trim()}%`;
      const qClean = `%${query.search.replace(/[,.]/g, '').trim()}%`;
      qb.andWhere(
        `(
          inv.invoice_no ILIKE :q
          OR inv.serial_no ILIKE :q
          OR inv.buyer_name ILIKE :q
          OR inv.seller_name ILIKE :q
          OR inv.buyer_tax_code ILIKE :q
          OR inv.seller_tax_code ILIKE :q
          OR ii.item_code ILIKE :q
          OR ii.description ILIKE :q
          OR REPLACE(REPLACE(CAST(ii.quantity AS TEXT), '.', ''), ',', '') ILIKE :qClean
          OR REPLACE(REPLACE(CAST(ii.unit_price AS TEXT), '.', ''), ',', '') ILIKE :qClean
          OR REPLACE(REPLACE(CAST(ii.pre_vat_amount AS TEXT), '.', ''), ',', '') ILIKE :qClean
          OR REPLACE(REPLACE(CAST(ii.vat_amount AS TEXT), '.', ''), ',', '') ILIKE :qClean
          OR REPLACE(REPLACE(CAST(ii.total_amount AS TEXT), '.', ''), ',', '') ILIKE :qClean
        )`,
        { q, qClean },
      );
    }

    // Column Search
    let columnSearch: Record<string, string> = {};
    let columnFilters: Record<string, string[]> = {};
    try {
      if (query.column_search) columnSearch = JSON.parse(query.column_search);
      if (query.column_filters)
        columnFilters = JSON.parse(query.column_filters);
    } catch (e) {
      this.logger.error('Failed to parse column_search or column_filters', e);
    }

    this._applyItemColumnSearch(qb, columnSearch, query.direction);
    this._applyItemColumnFilters(qb, columnFilters, query.direction);

    // Summary calculation and total count (calculated before applying orderBy to avoid Postgres aggregate error)
    const summaryQb = qb.clone();
    const summaryRaw = await summaryQb
      .select([
        'COALESCE(SUM(ii.quantity), 0) AS total_quantity',
        'COALESCE(SUM(ii.pre_vat_amount), 0) AS total_pre_vat_amount',
        'COALESCE(SUM(CASE WHEN ii.vat_amount != 0 THEN ii.vat_amount ELSE CASE WHEN ii.vat_rate IS NOT NULL AND ii.vat_rate != 0 THEN ROUND(ii.pre_vat_amount * CASE WHEN ABS(CAST(ii.vat_rate AS NUMERIC)) > 1 THEN CAST(ii.vat_rate AS NUMERIC) / 100.0 ELSE CAST(ii.vat_rate AS NUMERIC) END) ELSE 0 END END), 0) AS total_vat_amount',
        'COALESCE(SUM(ii.discount_amount), 0) AS total_discount_amount',
        'COALESCE(SUM(CASE WHEN ii.total_amount != 0 THEN ii.total_amount ELSE (ii.pre_vat_amount + (CASE WHEN ii.vat_amount != 0 THEN ii.vat_amount ELSE CASE WHEN ii.vat_rate IS NOT NULL AND ii.vat_rate != 0 THEN ROUND(ii.pre_vat_amount * CASE WHEN ABS(CAST(ii.vat_rate AS NUMERIC)) > 1 THEN CAST(ii.vat_rate AS NUMERIC) / 100.0 ELSE CAST(ii.vat_rate AS NUMERIC) END) ELSE 0 END END) - COALESCE(ii.discount_amount, 0)) END), 0) AS total_amount',
      ])
      .getRawOne();

    const total = await qb.getCount();

    // Sorting
    let sortColumn = 'inv.invoice_date';
    let sortOrder: 'ASC' | 'DESC' = 'DESC';

    if (query.sort_by) {
      const sortMap: Record<string, string> = {
        invoiceDate: 'inv.invoice_date',
        invoiceNo: 'inv.invoice_no',
        serialNo: 'inv.serial_no',
        partner:
          query.direction === 'IN' ? 'inv.seller_name' : 'inv.buyer_name',
        taxCode:
          query.direction === 'IN'
            ? 'inv.seller_tax_code'
            : 'inv.buyer_tax_code',
        itemCode: 'ii.item_code',
        description: 'ii.description',
        unit: 'ii.unit',
        quantity: 'ii.quantity',
        unitPrice: 'ii.unit_price',
        preVatAmount: 'ii.pre_vat_amount',
        vatRate: 'ii.vat_rate',
        vatAmount: 'ii.vat_amount',
        discountAmount: 'ii.discount_amount',
        totalAmount: 'ii.total_amount',
        invoiceSubcategory: 'ii.invoice_subcategory',
        status: 'inv.status',
        postingStatus: 'inv.posting_status',
        taxInvoiceStatus: 'inv.tax_invoice_status',
        branchId: 'inv.branch_id',
        branchName: 'b.name',
        licensePlate: 'inv.license_plate',
        settlementOrder: 'inv.settlement_order',
        createdAt: 'ii.created_at',
      };
      if (sortMap[query.sort_by]) {
        sortColumn = sortMap[query.sort_by];
      }
    }
    if (query.sort_order) {
      sortOrder = query.sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    }

    qb.orderBy(sortColumn, sortOrder)
      .addOrderBy('inv.invoice_no', 'DESC')
      .addOrderBy('ii.id', 'ASC');

    const rawItems = await qb
      .select([
        'ii.id AS id',
        'ii.invoice_id AS invoice_id',
        'ii.item_code AS item_code',
        'ii.description AS description',
        'ii.unit AS unit',
        'ii.quantity AS quantity',
        'ii.unit_price AS unit_price',
        'ii.pre_vat_amount AS pre_vat_amount',
        'ii.vat_rate AS vat_rate',
        'ii.vat_amount AS vat_amount',
        'ii.discount_amount AS discount_amount',
        'ii.total_amount AS total_amount',
        'ii.invoice_subcategory AS invoice_subcategory',
        'ii.created_at AS created_at',
        'inv.invoice_no AS invoice_no',
        'inv.serial_no AS serial_no',
        "TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') AS invoice_date",
        'inv.direction AS direction',
        'inv.status AS status',
        'inv.posting_status AS posting_status',
        'inv.seller_name AS seller_name',
        'inv.seller_tax_code AS seller_tax_code',
        'inv.buyer_name AS buyer_name',
        'inv.buyer_personal_name AS buyer_personal_name',
        'inv.buyer_tax_code AS buyer_tax_code',
        'inv.buyer_cccd AS buyer_cccd',
        'inv.license_plate AS license_plate',
        'inv.settlement_order AS settlement_order',
        'inv.branch_id AS branch_id',
        'inv.tax_invoice_status AS tax_invoice_status',
        'b.name AS branch_name',
      ])
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany();

    const items = rawItems.map((r) => {
      const preVat = Number(r.pre_vat_amount || 0);
      const disc = Number(r.discount_amount || 0);
      const vRateDisplay =
        r.vat_rate !== null ? parseVatRateForDisplay(r.vat_rate) : null;
      let vatAmt = Number(r.vat_amount || 0);
      if (vatAmt === 0 && vRateDisplay !== null && preVat !== 0) {
        const vRateNum =
          typeof vRateDisplay === 'number'
            ? vRateDisplay
            : parseFloat(String(vRateDisplay));
        if (!isNaN(vRateNum)) {
          const decimalRate =
            Math.abs(vRateNum) > 1 ? vRateNum / 100 : vRateNum;
          vatAmt = Math.round(preVat * decimalRate);
        }
      }
      let totalAmt = Number(r.total_amount || 0);
      if (totalAmt === 0 && (preVat !== 0 || vatAmt !== 0 || disc !== 0)) {
        totalAmt = preVat + vatAmt - disc;
      }

      return {
        id: r.id,
        invoiceId: r.invoice_id,
        invoiceNo: r.invoice_no,
        serialNo: r.serial_no,
        invoiceDate: r.invoice_date || '',
        direction: r.direction,
        status: r.status,
        postingStatus: r.posting_status,
        sellerName: r.seller_name,
        sellerTaxCode: r.seller_tax_code,
        buyerName: r.buyer_name,
        buyerPersonalName: r.buyer_personal_name,
        buyerTaxCode: r.buyer_tax_code,
        buyerCccd: r.buyer_cccd,
        licensePlate: r.license_plate,
        settlementOrder: r.settlement_order,
        branchId: r.branch_id,
        taxInvoiceStatus:
          r.tax_invoice_status !== null && r.tax_invoice_status !== undefined
            ? Number(r.tax_invoice_status)
            : null,
        branchName: r.branch_name || null,
        itemCode: r.item_code,
        description: r.description,
        unit: r.unit,
        quantity: r.quantity !== null ? Number(r.quantity) : null,
        unitPrice: r.unit_price !== null ? Number(r.unit_price) : null,
        preVatAmount: preVat,
        vatRate: vRateDisplay,
        vatAmount: vatAmt,
        discountAmount: disc,
        totalAmount: totalAmt,
        invoiceSubcategory: r.invoice_subcategory || 'NORMAL',
        createdAt: r.created_at,
      };
    });

    const totalPages = Math.ceil(total / pageSize);
    const grandTotalQuantity = Number(summaryRaw?.total_quantity || 0);
    const grandTotalPreVatAmount = Number(
      summaryRaw?.total_pre_vat_amount || 0,
    );
    const grandTotalVatAmount = Number(summaryRaw?.total_vat_amount || 0);
    const grandTotalDiscountAmount = Number(
      summaryRaw?.total_discount_amount || 0,
    );
    const grandTotalAmount = Number(summaryRaw?.total_amount || 0);

    let cumulativeQuantity = 0;
    let cumulativePreVatAmount = 0;
    let cumulativeVatAmount = 0;
    let cumulativeDiscountAmount = 0;
    let cumulativeTotalAmount = 0;

    try {
      if (page === 1) {
        cumulativeQuantity = items.reduce(
          (acc, curr) => acc + (Number(curr.quantity) || 0),
          0,
        );
        cumulativePreVatAmount = items.reduce(
          (acc, curr) => acc + (Number(curr.preVatAmount) || 0),
          0,
        );
        cumulativeVatAmount = items.reduce(
          (acc, curr) => acc + (Number(curr.vatAmount) || 0),
          0,
        );
        cumulativeDiscountAmount = items.reduce(
          (acc, curr) => acc + (Number(curr.discountAmount) || 0),
          0,
        );
        cumulativeTotalAmount = items.reduce(
          (acc, curr) => acc + (Number(curr.totalAmount) || 0),
          0,
        );
      } else if (page >= totalPages && totalPages > 0) {
        cumulativeQuantity = grandTotalQuantity;
        cumulativePreVatAmount = grandTotalPreVatAmount;
        cumulativeVatAmount = grandTotalVatAmount;
        cumulativeDiscountAmount = grandTotalDiscountAmount;
        cumulativeTotalAmount = grandTotalAmount;
      } else {
        const cumQb = qb.clone();
        if (cumQb.expressionMap) {
          cumQb.expressionMap.selects = [];
        }
        cumQb
          .select([
            'ii.quantity AS quantity',
            'ii.pre_vat_amount AS pre_vat_amount',
            'ii.vat_rate AS vat_rate',
            'ii.vat_amount AS vat_amount',
            'ii.discount_amount AS discount_amount',
            'ii.total_amount AS total_amount',
          ])
          .offset(0)
          .limit(page * pageSize);
        cumQb.skip?.(undefined);
        cumQb.take?.(undefined);

        const cumRows = await cumQb.getRawMany();
        cumulativeQuantity = cumRows.reduce(
          (acc, r) => acc + (Number(r.quantity) || 0),
          0,
        );
        cumulativePreVatAmount = cumRows.reduce(
          (acc, r) => acc + (Number(r.pre_vat_amount) || 0),
          0,
        );
        cumulativeDiscountAmount = cumRows.reduce(
          (acc, r) => acc + (Number(r.discount_amount) || 0),
          0,
        );
        cumulativeVatAmount = cumRows.reduce((acc, r) => {
          const preVat = Number(r.pre_vat_amount || 0);
          const vRateDisplay =
            r.vat_rate !== null ? parseVatRateForDisplay(r.vat_rate) : null;
          let vatAmt = Number(r.vat_amount || 0);
          if (vatAmt === 0 && vRateDisplay !== null && preVat !== 0) {
            const vRateNum =
              typeof vRateDisplay === 'number'
                ? vRateDisplay
                : parseFloat(String(vRateDisplay));
            if (!isNaN(vRateNum)) {
              const decimalRate =
                Math.abs(vRateNum) > 1 ? vRateNum / 100 : vRateNum;
              vatAmt = Math.round(preVat * decimalRate);
            }
          }
          return acc + vatAmt;
        }, 0);
        cumulativeTotalAmount = cumRows.reduce((acc, r) => {
          const preVat = Number(r.pre_vat_amount || 0);
          const disc = Number(r.discount_amount || 0);
          const vRateDisplay =
            r.vat_rate !== null ? parseVatRateForDisplay(r.vat_rate) : null;
          let vatAmt = Number(r.vat_amount || 0);
          if (vatAmt === 0 && vRateDisplay !== null && preVat !== 0) {
            const vRateNum =
              typeof vRateDisplay === 'number'
                ? vRateDisplay
                : parseFloat(String(vRateDisplay));
            if (!isNaN(vRateNum)) {
              const decimalRate =
                Math.abs(vRateNum) > 1 ? vRateNum / 100 : vRateNum;
              vatAmt = Math.round(preVat * decimalRate);
            }
          }
          let totalAmt = Number(r.total_amount || 0);
          if (totalAmt === 0 && (preVat !== 0 || vatAmt !== 0 || disc !== 0)) {
            totalAmt = preVat + vatAmt - disc;
          }
          return acc + totalAmt;
        }, 0);
      }
    } catch (e) {
      this.logger.error(
        `Error calculating cumulative totals in findAllItems: ${e}`,
      );
    }

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      summary: {
        totalQuantity: grandTotalQuantity,
        totalPreVatAmount: grandTotalPreVatAmount,
        totalVatAmount: grandTotalVatAmount,
        totalDiscountAmount: grandTotalDiscountAmount,
        totalAmount: grandTotalAmount,
        cumulativeQuantity,
        cumulativePreVatAmount,
        cumulativeVatAmount,
        cumulativeDiscountAmount,
        cumulativeTotalAmount,
      },
    };
  }

  private _applyItemColumnSearch(
    qb: any,
    columnSearch: Record<string, string>,
    direction?: string,
  ) {
    Object.keys(columnSearch).forEach((key) => {
      const val = columnSearch[key];
      if (!val) return;

      if (key === 'invoiceNo') {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['inv.invoice_no', 'inv.serial_no'],
          val,
          'itemInvoiceNoSearch',
        );
      } else if (key === 'serialNo') {
        applyMultiKeywordFilter(qb, 'inv.serial_no', val, 'itemSerialNoSearch');
      } else if (key === 'partner') {
        if (direction === 'IN') {
          applyMultiKeywordMultiFieldFilter(
            qb,
            ['inv.seller_name', 'inv.seller_tax_code'],
            val,
            'itemPartnerSearch',
          );
        } else if (direction === 'OUT') {
          applyMultiKeywordMultiFieldFilter(
            qb,
            ['inv.buyer_name', 'inv.buyer_personal_name', 'inv.buyer_tax_code'],
            val,
            'itemPartnerSearch',
          );
        } else {
          applyMultiKeywordMultiFieldFilter(
            qb,
            [
              'inv.seller_name',
              'inv.seller_tax_code',
              'inv.buyer_name',
              'inv.buyer_personal_name',
              'inv.buyer_tax_code',
            ],
            val,
            'itemPartnerSearch',
          );
        }
      } else if (key === 'taxCode') {
        if (direction === 'IN') {
          applyMultiKeywordFilter(
            qb,
            'inv.seller_tax_code',
            val,
            'itemTaxCodeSearch',
          );
        } else if (direction === 'OUT') {
          applyMultiKeywordFilter(
            qb,
            'inv.buyer_tax_code',
            val,
            'itemTaxCodeSearch',
          );
        } else {
          applyMultiKeywordMultiFieldFilter(
            qb,
            ['inv.seller_tax_code', 'inv.buyer_tax_code'],
            val,
            'itemTaxCodeSearch',
          );
        }
      } else if (key === 'itemCode') {
        applyMultiKeywordFilter(qb, 'ii.item_code', val, 'itemCodeSearch');
      } else if (key === 'description') {
        applyMultiKeywordFilter(qb, 'ii.description', val, 'itemDescSearch');
      } else if (key === 'unit') {
        applyMultiKeywordFilter(qb, 'ii.unit', val, 'itemUnitSearch');
      } else if (key === 'quantity') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(ii.quantity AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'itemQtySearch',
        );
      } else if (key === 'unitPrice') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(ii.unit_price AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'itemUnitPriceSearch',
        );
      } else if (key === 'preVatAmount') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(ii.pre_vat_amount AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'itemPreVatSearch',
        );
      } else if (key === 'vatRate') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(ii.vat_rate AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'itemVatRateSearch',
        );
      } else if (key === 'vatAmount') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(ii.vat_amount AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'itemVatAmountSearch',
        );
      } else if (key === 'discountAmount') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(ii.discount_amount AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'itemDiscountSearch',
        );
      } else if (key === 'totalAmount') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(ii.total_amount AS TEXT), '.', ''), ',', '')",
          val.replace(/[,.]/g, ''),
          'itemTotalSearch',
        );
      } else if (key === 'invoiceSubcategory') {
        applyMultiKeywordFilter(
          qb,
          'ii.invoice_subcategory',
          val,
          'itemSubcatSearch',
        );
      } else if (key === 'status') {
        applyMultiKeywordFilter(qb, 'inv.status', val, 'itemStatusSearch');
      } else if (key === 'postingStatus') {
        applyMultiKeywordFilter(
          qb,
          'inv.posting_status',
          val,
          'itemPostingStatusSearch',
        );
      } else if (key === 'taxInvoiceStatus') {
        applyMultiKeywordFilter(
          qb,
          'CAST(inv.tax_invoice_status AS TEXT)',
          val,
          'itemTaxInvoiceStatusSearch',
        );
      } else if (key === 'branchId' || key === 'branchName') {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['inv.branch_id', 'b.name', 'b.code'],
          val,
          'itemBranchSearch',
        );
      } else if (key === 'licensePlate') {
        applyMultiKeywordFilter(
          qb,
          'inv.license_plate',
          val,
          'itemPlateSearch',
        );
      } else if (key === 'settlementOrder') {
        applyMultiKeywordFilter(
          qb,
          'inv.settlement_order',
          val,
          'itemSettlementSearch',
        );
      } else if (key === 'invoiceDate') {
        const rawKw = String(val);
        if (rawKw.includes('|')) {
          const [from, to] = rawKw.split('|');
          if (from && to) {
            qb.andWhere(
              `inv.invoice_date >= :item_from_invDate AND inv.invoice_date <= :item_to_invDate`,
              {
                item_from_invDate: from,
                item_to_invDate: to + ' 23:59:59',
              },
            );
          } else if (from) {
            qb.andWhere(`inv.invoice_date >= :item_from_invDate`, {
              item_from_invDate: from,
            });
          } else if (to) {
            qb.andWhere(`inv.invoice_date <= :item_to_invDate`, {
              item_to_invDate: to + ' 23:59:59',
            });
          }
        } else {
          applyMultiKeywordFilter(
            qb,
            "TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')",
            val,
            'itemInvoiceDateSearch',
          );
        }
      }
    });
  }

  private _applyItemColumnFilters(
    qb: any,
    columnFilters: Record<string, string[]>,
    direction?: string,
  ) {
    Object.keys(columnFilters).forEach((key) => {
      const vals = columnFilters[key];
      if (!vals || vals.length === 0) return;

      if (vals[0] === '__ALL_MATCHING__') {
        const searchStr = vals[1] || '';
        if (searchStr) {
          this._applyItemColumnSearch(qb, { [key]: searchStr }, direction);
        }
        return;
      }

      if (key === 'invoiceNo') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        const conds: string[] = [];
        const params: Record<string, any> = {};
        const simpleVals: string[] = [];

        realVals.forEach((v, idx) => {
          if (v.includes(':::')) {
            const [invNo, serNo] = v.split(':::');
            conds.push(
              `(TRIM(inv.invoice_no) = :item_invNo_${idx} AND TRIM(inv.serial_no) = :item_serNo_${idx})`,
            );
            params[`item_invNo_${idx}`] = invNo.trim();
            params[`item_serNo_${idx}`] = serNo.trim();
          } else {
            simpleVals.push(v.trim());
          }
        });

        if (simpleVals.length > 0) {
          conds.push(
            '(TRIM(inv.invoice_no) IN (:...itemSimpleInvoiceNos) OR TRIM(inv.serial_no) IN (:...itemSimpleInvoiceNos))',
          );
          params['itemSimpleInvoiceNos'] = simpleVals;
        }

        if (hasBlank) {
          conds.push(
            "(inv.invoice_no IS NULL OR CAST(inv.invoice_no AS TEXT) = '')",
          );
        }

        if (conds.length > 0) {
          qb.andWhere(`(${conds.join(' OR ')})`, params);
        }
      } else if (key === 'serialNo') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        if (hasBlank && realVals.length > 0) {
          qb.andWhere(
            "(inv.serial_no IN (:...item_serVals) OR inv.serial_no IS NULL OR inv.serial_no = '')",
            { item_serVals: realVals },
          );
        } else if (hasBlank) {
          qb.andWhere("(inv.serial_no IS NULL OR inv.serial_no = '')");
        } else {
          qb.andWhere('inv.serial_no IN (:...item_serVals)', {
            item_serVals: vals,
          });
        }
      } else if (key === 'partner') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        const nameField =
          direction === 'IN'
            ? 'inv.seller_name'
            : direction === 'OUT'
              ? "COALESCE(NULLIF(inv.buyer_name, ''), inv.buyer_personal_name)"
              : "(CASE WHEN inv.direction = 'IN' THEN inv.seller_name ELSE COALESCE(NULLIF(inv.buyer_name, ''), inv.buyer_personal_name) END)";
        const taxField =
          direction === 'IN'
            ? 'inv.seller_tax_code'
            : direction === 'OUT'
              ? 'inv.buyer_tax_code'
              : "(CASE WHEN inv.direction = 'IN' THEN inv.seller_tax_code ELSE inv.buyer_tax_code END)";

        const conds: string[] = [];
        const params: Record<string, any> = {};
        const simpleVals: string[] = [];

        realVals.forEach((v, idx) => {
          if (v.includes(':::')) {
            const [tax, name] = v.split(':::');
            if (tax && name) {
              conds.push(
                `(TRIM(${taxField}) = :itemPartnerTax_${idx} OR TRIM(${nameField}) ILIKE :itemPartnerName_${idx})`,
              );
              params[`itemPartnerTax_${idx}`] = tax.trim();
              params[`itemPartnerName_${idx}`] = `%${name.trim()}%`;
            } else if (tax) {
              conds.push(`TRIM(${taxField}) = :itemPartnerTax_${idx}`);
              params[`itemPartnerTax_${idx}`] = tax.trim();
            } else if (name) {
              conds.push(`TRIM(${nameField}) ILIKE :itemPartnerName_${idx}`);
              params[`itemPartnerName_${idx}`] = `%${name.trim()}%`;
            }
          } else {
            simpleVals.push(v.trim());
          }
        });

        if (simpleVals.length > 0) {
          conds.push(
            `(TRIM(${nameField}) IN (:...itemSimplePartners) OR TRIM(${taxField}) IN (:...itemSimplePartners))`,
          );
          params['itemSimplePartners'] = simpleVals;
        }

        if (hasBlank) {
          conds.push(
            `(${nameField} IS NULL OR CAST(${nameField} AS TEXT) = '')`,
          );
        }

        if (conds.length > 0) {
          qb.andWhere(`(${conds.join(' OR ')})`, params);
        }
      } else if (key === 'taxCode') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        const field =
          direction === 'IN'
            ? 'inv.seller_tax_code'
            : direction === 'OUT'
              ? 'inv.buyer_tax_code'
              : "(CASE WHEN inv.direction = 'IN' THEN inv.seller_tax_code ELSE inv.buyer_tax_code END)";

        if (hasBlank && realVals.length > 0) {
          qb.andWhere(
            `(${field} IN (:...itemTaxCodeVals) OR ${field} IS NULL OR CAST(${field} AS TEXT) = '')`,
            { itemTaxCodeVals: realVals },
          );
        } else if (hasBlank) {
          qb.andWhere(`(${field} IS NULL OR CAST(${field} AS TEXT) = '')`);
        } else {
          qb.andWhere(`${field} IN (:...itemTaxCodeVals)`, {
            itemTaxCodeVals: vals,
          });
        }
      } else if (key === 'itemCode') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        if (hasBlank && realVals.length > 0) {
          qb.andWhere(
            "(ii.item_code IN (:...itemCodeVals) OR ii.item_code IS NULL OR ii.item_code = '')",
            { itemCodeVals: realVals },
          );
        } else if (hasBlank) {
          qb.andWhere("(ii.item_code IS NULL OR ii.item_code = '')");
        } else {
          qb.andWhere('ii.item_code IN (:...itemCodeVals)', {
            itemCodeVals: vals,
          });
        }
      } else if (key === 'description') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        if (hasBlank && realVals.length > 0) {
          qb.andWhere(
            "(ii.description IN (:...itemDescVals) OR ii.description IS NULL OR ii.description = '')",
            { itemDescVals: realVals },
          );
        } else if (hasBlank) {
          qb.andWhere("(ii.description IS NULL OR ii.description = '')");
        } else {
          qb.andWhere('ii.description IN (:...itemDescVals)', {
            itemDescVals: vals,
          });
        }
      } else if (key === 'unit') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        if (hasBlank && realVals.length > 0) {
          qb.andWhere(
            "(ii.unit IN (:...itemUnitVals) OR ii.unit IS NULL OR ii.unit = '')",
            { itemUnitVals: realVals },
          );
        } else if (hasBlank) {
          qb.andWhere("(ii.unit IS NULL OR ii.unit = '')");
        } else {
          qb.andWhere('ii.unit IN (:...itemUnitVals)', {
            itemUnitVals: vals,
          });
        }
      } else if (key === 'quantity') {
        qb.andWhere('CAST(ii.quantity AS TEXT) IN (:...itemQtyVals)', {
          itemQtyVals: vals,
        });
      } else if (key === 'unitPrice') {
        qb.andWhere('CAST(ii.unit_price AS TEXT) IN (:...itemUnitPriceVals)', {
          itemUnitPriceVals: vals,
        });
      } else if (key === 'preVatAmount') {
        qb.andWhere('CAST(ii.pre_vat_amount AS TEXT) IN (:...itemPreVatVals)', {
          itemPreVatVals: vals,
        });
      } else if (key === 'vatRate') {
        const numericRates = vals
          .map((v) => Number(v))
          .filter((v) => !isNaN(v));
        const hasNull = vals.includes('__BLANK__') || vals.includes('null');
        if (numericRates.length > 0 && hasNull) {
          qb.andWhere(
            '(ii.vat_rate IN (:...itemVatRates) OR ii.vat_rate IS NULL)',
            { itemVatRates: numericRates },
          );
        } else if (numericRates.length > 0) {
          qb.andWhere('ii.vat_rate IN (:...itemVatRates)', {
            itemVatRates: numericRates,
          });
        } else if (hasNull) {
          qb.andWhere('ii.vat_rate IS NULL');
        }
      } else if (key === 'vatAmount') {
        qb.andWhere('CAST(ii.vat_amount AS TEXT) IN (:...itemVatAmountVals)', {
          itemVatAmountVals: vals,
        });
      } else if (key === 'discountAmount') {
        qb.andWhere('CAST(ii.discount_amount AS TEXT) IN (:...itemDiscVals)', {
          itemDiscVals: vals,
        });
      } else if (key === 'totalAmount') {
        qb.andWhere('CAST(ii.total_amount AS TEXT) IN (:...itemTotalVals)', {
          itemTotalVals: vals,
        });
      } else if (key === 'invoiceSubcategory') {
        qb.andWhere('ii.invoice_subcategory IN (:...itemSubcatVals)', {
          itemSubcatVals: vals,
        });
      } else if (key === 'status') {
        qb.andWhere('inv.status IN (:...itemStatusVals)', {
          itemStatusVals: vals,
        });
      } else if (key === 'postingStatus') {
        qb.andWhere('inv.posting_status IN (:...itemPostStatusVals)', {
          itemPostStatusVals: vals,
        });
      } else if (key === 'taxInvoiceStatus') {
        const numericVals = vals.map((v) => Number(v)).filter((v) => !isNaN(v));
        const hasNull = vals.includes('__BLANK__') || vals.includes('null');
        if (numericVals.length > 0 && hasNull) {
          qb.andWhere(
            '(inv.tax_invoice_status IN (:...itemTaxStatusVals) OR inv.tax_invoice_status IS NULL)',
            { itemTaxStatusVals: numericVals },
          );
        } else if (numericVals.length > 0) {
          qb.andWhere('inv.tax_invoice_status IN (:...itemTaxStatusVals)', {
            itemTaxStatusVals: numericVals,
          });
        } else if (hasNull) {
          qb.andWhere('inv.tax_invoice_status IS NULL');
        }
      } else if (key === 'branchId' || key === 'branchName') {
        const hasBlank =
          vals.includes('__BLANK__') ||
          vals.includes('null') ||
          vals.includes('');
        const realVals = vals.filter(
          (v) => v !== '__BLANK__' && v !== 'null' && v !== '',
        );
        if (hasBlank && realVals.length > 0) {
          qb.andWhere(
            '(inv.branch_id IN (:...itemBranchVals) OR inv.branch_id IS NULL)',
            { itemBranchVals: realVals },
          );
        } else if (hasBlank) {
          qb.andWhere('inv.branch_id IS NULL');
        } else if (realVals.length > 0) {
          qb.andWhere('inv.branch_id IN (:...itemBranchVals)', {
            itemBranchVals: realVals,
          });
        }
      } else if (key === 'licensePlate') {
        qb.andWhere('inv.license_plate IN (:...itemLpVals)', {
          itemLpVals: vals,
        });
      } else if (key === 'settlementOrder') {
        qb.andWhere('inv.settlement_order IN (:...itemSoVals)', {
          itemSoVals: vals,
        });
      } else if (key === 'invoiceDate') {
        qb.andWhere(
          `TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') IN (:...itemInvDateVals)`,
          { itemInvDateVals: vals },
        );
      }
    });
  }

  async getItemColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    direction?: 'IN' | 'OUT',
  ) {
    const itemRepo =
      this.itemRepository ||
      this.repository.manager.getRepository(ErpInvoiceItem);

    const qb = itemRepo
      .createQueryBuilder('ii')
      .innerJoin(ErpInvoice, 'inv', 'inv.id = ii.invoice_id')
      .where('inv.is_deleted = false');

    if (direction) {
      qb.andWhere('inv.direction = :direction', { direction });
    }

    let selectField = '';
    let isDateColumn = false;
    let isCustomGroupColumn = false;
    let customSecondaryField = '';

    if (column === 'invoiceDate') {
      selectField = "TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')";
      isDateColumn = true;
    } else if (column === 'serialNo') {
      selectField = 'TRIM(inv.serial_no)';
    } else if (column === 'invoiceNo') {
      selectField = 'TRIM(inv.invoice_no)';
      customSecondaryField = 'TRIM(inv.serial_no)';
      isCustomGroupColumn = true;
    } else if (column === 'partner') {
      isCustomGroupColumn = true;
      if (direction === 'IN') {
        selectField = "TRIM(COALESCE(inv.seller_name, ''))";
        customSecondaryField = "TRIM(COALESCE(inv.seller_tax_code, ''))";
      } else if (direction === 'OUT') {
        selectField =
          "TRIM(COALESCE(NULLIF(inv.buyer_name, ''), inv.buyer_personal_name, ''))";
        customSecondaryField = "TRIM(COALESCE(inv.buyer_tax_code, ''))";
      } else {
        selectField =
          "TRIM(CASE WHEN inv.direction = 'IN' THEN COALESCE(inv.seller_name, '') ELSE COALESCE(NULLIF(inv.buyer_name, ''), inv.buyer_personal_name, '') END)";
        customSecondaryField =
          "TRIM(CASE WHEN inv.direction = 'IN' THEN COALESCE(inv.seller_tax_code, '') ELSE COALESCE(inv.buyer_tax_code, '') END)";
      }
    } else if (column === 'taxCode') {
      if (direction === 'IN') selectField = 'TRIM(inv.seller_tax_code)';
      else if (direction === 'OUT') selectField = 'TRIM(inv.buyer_tax_code)';
      else
        selectField =
          "TRIM(CASE WHEN inv.direction = 'IN' THEN inv.seller_tax_code WHEN inv.direction = 'OUT' THEN inv.buyer_tax_code END)";
    } else if (column === 'itemCode') selectField = 'ii.item_code';
    else if (column === 'description') selectField = 'ii.description';
    else if (column === 'unit') selectField = 'ii.unit';
    else if (column === 'quantity') selectField = 'ii.quantity';
    else if (column === 'unitPrice') selectField = 'ii.unit_price';
    else if (column === 'preVatAmount') selectField = 'ii.pre_vat_amount';
    else if (column === 'vatRate') selectField = 'ii.vat_rate';
    else if (column === 'vatAmount') selectField = 'ii.vat_amount';
    else if (column === 'discountAmount') selectField = 'ii.discount_amount';
    else if (column === 'totalAmount') selectField = 'ii.total_amount';
    else if (column === 'invoiceSubcategory')
      selectField = 'ii.invoice_subcategory';
    else if (column === 'status') selectField = 'inv.status';
    else if (column === 'postingStatus') selectField = 'inv.posting_status';
    else if (column === 'taxInvoiceStatus')
      selectField = 'inv.tax_invoice_status';
    else if (column === 'branchId' || column === 'branchName')
      selectField = 'inv.branch_id';
    else if (column === 'licensePlate') selectField = 'inv.license_plate';
    else if (column === 'settlementOrder') selectField = 'inv.settlement_order';
    else return { items: [], total: 0, page, pageSize, totalPages: 0 };

    if (isCustomGroupColumn) {
      qb.select(`${selectField}`, 'value').addSelect(
        `${customSecondaryField}`,
        'secondary_val',
      );
      qb.andWhere(
        `((${selectField} IS NOT NULL AND CAST(${selectField} AS TEXT) != '') OR (${customSecondaryField} IS NOT NULL AND CAST(${customSecondaryField} AS TEXT) != ''))`,
      );
      qb.groupBy(`${selectField}`).addGroupBy(`${customSecondaryField}`);
    } else {
      qb.select(`DISTINCT ${selectField}`, 'value');
      if (isDateColumn) {
        qb.andWhere('inv.invoice_date IS NOT NULL');
        qb.andWhere(`${selectField} != ''`);
      } else {
        qb.andWhere(`${selectField} IS NOT NULL`);
        qb.andWhere(`CAST(${selectField} AS TEXT) != ''`);
      }
    }

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        const activeFilters: Record<string, string[]> = {};
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue;
          activeFilters[col] = vals;
        }
        if (Object.keys(activeFilters).length > 0) {
          this._applyItemColumnFilters(qb, activeFilters, direction);
        }
      } catch {
        // ignore malformed filters
      }
    }

    if (search && search.trim()) {
      if (column === 'invoiceNo') {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['inv.invoice_no', 'inv.serial_no'],
          search,
          'itemOptInvNoSearch',
        );
      } else if (column === 'partner') {
        if (direction === 'IN') {
          applyMultiKeywordMultiFieldFilter(
            qb,
            ['inv.seller_name', 'inv.seller_tax_code'],
            search,
            'itemOptPartnerSearch',
          );
        } else if (direction === 'OUT') {
          applyMultiKeywordMultiFieldFilter(
            qb,
            ['inv.buyer_name', 'inv.buyer_personal_name', 'inv.buyer_tax_code'],
            search,
            'itemOptPartnerSearch',
          );
        } else {
          applyMultiKeywordMultiFieldFilter(
            qb,
            [
              'inv.seller_name',
              'inv.seller_tax_code',
              'inv.buyer_name',
              'inv.buyer_personal_name',
              'inv.buyer_tax_code',
            ],
            search,
            'itemOptPartnerSearch',
          );
        }
      } else {
        let searchField = `CAST(${selectField} AS TEXT)`;
        let searchKeyword = search;

        if (
          [
            'quantity',
            'unitPrice',
            'preVatAmount',
            'vatAmount',
            'discountAmount',
            'totalAmount',
          ].includes(column)
        ) {
          searchField = `REPLACE(REPLACE(CAST(${selectField} AS TEXT), '.', ''), ',', '')`;
          searchKeyword = search.replace(/[,.]/g, '');
        }

        applyMultiKeywordFilter(
          qb,
          searchField,
          searchKeyword,
          'itemOptSearch',
        );
      }
    }

    if (column === 'invoiceDate') {
      qb.orderBy(`${selectField}`, 'DESC');
    } else {
      qb.orderBy(`${selectField}`, 'ASC');
    }

    const countQb = qb.clone();
    if (countQb.expressionMap) {
      countQb.expressionMap.groupBys = [];
      countQb.expressionMap.selects = [];
      countQb.expressionMap.orderBys = {};
    }
    countQb.offset?.(undefined);
    countQb.limit?.(undefined);
    countQb.skip?.(undefined);
    countQb.take?.(undefined);

    let total = 0;
    try {
      if (isCustomGroupColumn) {
        const totalRaw = await countQb
          .select(
            `COUNT(DISTINCT CONCAT(COALESCE(${selectField}, ''), ':', COALESCE(${customSecondaryField}, '')))`,
            'cnt',
          )
          .getRawOne();
        total = parseInt(totalRaw?.cnt || '0', 10);
      } else {
        const totalRaw = await countQb
          .select(`COUNT(DISTINCT ${selectField})`, 'cnt')
          .getRawOne();
        total = parseInt(totalRaw?.cnt || '0', 10);
      }
    } catch {
      total = 0;
    }

    qb.offset((page - 1) * pageSize).limit(pageSize);
    const rawItems = await qb.getRawMany();

    let items: any[] = [];
    if (column === 'invoiceNo') {
      const seen = new Set<string>();
      items = rawItems
        .map((r) => {
          const val = r.value ? String(r.value).trim() : '';
          const sec = r.secondary_val ? String(r.secondary_val).trim() : '';
          const label = sec ? `${val} (${sec})` : val;
          const value = sec ? `${val}:::${sec}` : val;
          return { value, label: label || val, secondaryLabel: sec };
        })
        .filter((x) => {
          if (!x.value || seen.has(x.value)) return false;
          seen.add(x.value);
          return true;
        });
    } else if (column === 'partner') {
      const seen = new Set<string>();
      items = rawItems
        .map((r) => {
          const name = r.value ? String(r.value).trim() : '';
          const tax = r.secondary_val ? String(r.secondary_val).trim() : '';
          const label = name && tax ? `${name} (${tax})` : name || tax || '—';
          const value = tax && name ? `${tax}:::${name}` : tax || name;
          return { value, label, secondaryLabel: tax };
        })
        .filter((x) => {
          if (!x.value || seen.has(x.value)) return false;
          seen.add(x.value);
          return true;
        });
    } else {
      const seen = new Set<string>();
      items = rawItems
        .map((r) => {
          let val =
            r.value !== undefined && r.value !== null
              ? String(r.value).trim()
              : '';
          if (column === 'vatRate' && val) {
            val = String(parseVatRateForDisplay(val));
          }
          return { value: val, label: val };
        })
        .filter((x) => {
          if (!x.value || seen.has(x.value)) return false;
          seen.add(x.value);
          return true;
        });
    }

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async exportItemsExcel(query: ErpInvoiceItemQuery): Promise<Buffer> {
    const result = await this.findAllItems({
      ...query,
      page: 1,
      pageSize: 100000,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Liouni ERP';
    workbook.lastModifiedBy = 'Liouni ERP';
    workbook.created = new Date();

    const sheetName =
      query.direction === 'OUT' ? 'Dòng HĐ Đầu Ra' : 'Dòng HĐ Đầu Vào';
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
    });

    const formatTaxInvoiceStatus = (val?: number | null) => {
      switch (val) {
        case 1:
          return 'Mới';
        case 2:
          return 'Thay thế';
        case 3:
          return 'Điều chỉnh';
        case 4:
          return 'Bị thay thế';
        case 5:
          return 'Bị điều chỉnh';
        case 6:
          return 'Bị hủy';
        default:
          return val?.toString() || '—';
      }
    };

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Số HĐ', key: 'invoiceNo', width: 16 },
      { header: 'Ký hiệu', key: 'serialNo', width: 14 },
      { header: 'Ngày HĐ', key: 'invoiceDate', width: 14 },
      {
        header: query.direction === 'OUT' ? 'Người mua' : 'Người bán',
        key: 'partnerName',
        width: 32,
      },
      { header: 'Mã số thuế', key: 'taxCode', width: 16 },
      { header: 'Mã hàng', key: 'itemCode', width: 16 },
      {
        header: 'Diễn giải / Tên hàng hóa, dịch vụ',
        key: 'description',
        width: 40,
      },
      { header: 'ĐVT', key: 'unit', width: 10 },
      { header: 'Số lượng', key: 'quantity', width: 12 },
      { header: 'Đơn giá', key: 'unitPrice', width: 16 },
      { header: 'Thành tiền', key: 'preVatAmount', width: 18 },
      { header: 'Thuế suất', key: 'vatRate', width: 12 },
      { header: 'Tiền thuế VAT', key: 'vatAmount', width: 16 },
      { header: 'Chiết khấu', key: 'discountAmount', width: 16 },
      { header: 'Tổng thanh toán', key: 'totalAmount', width: 20 },
      { header: 'Chi nhánh', key: 'branchName', width: 22 },
      { header: 'Trạng thái GĐT', key: 'taxInvoiceStatus', width: 16 },
    ];

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 26;

    result.items.forEach((item, index) => {
      const row = worksheet.addRow({
        stt: index + 1,
        invoiceNo: item.invoiceNo || '',
        serialNo: item.serialNo || '',
        invoiceDate: item.invoiceDate || '',
        partnerName:
          query.direction === 'OUT'
            ? item.buyerName || item.buyerPersonalName || ''
            : item.sellerName || '',
        taxCode:
          query.direction === 'OUT'
            ? item.buyerTaxCode || item.buyerCccd || ''
            : item.sellerTaxCode || '',
        itemCode: item.itemCode || '',
        description: item.description || '',
        unit: item.unit || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        preVatAmount: item.preVatAmount,
        vatRate: item.vatRate ? `${item.vatRate}` : '',
        vatAmount: item.vatAmount,
        discountAmount: item.discountAmount,
        totalAmount: item.totalAmount,
        branchName: item.branchName || '',
        taxInvoiceStatus: formatTaxInvoiceStatus(item.taxInvoiceStatus),
      });

      row.getCell('stt').alignment = { horizontal: 'center' };
      row.getCell('invoiceDate').alignment = { horizontal: 'center' };
      row.getCell('taxCode').alignment = { horizontal: 'center' };
      row.getCell('unit').alignment = { horizontal: 'center' };
      row.getCell('vatRate').alignment = { horizontal: 'center' };
      row.getCell('status').alignment = { horizontal: 'center' };
      row.getCell('postingStatus').alignment = { horizontal: 'center' };

      row.getCell('quantity').numFmt = '#,##0.00';
      row.getCell('unitPrice').numFmt = '#,##0';
      row.getCell('preVatAmount').numFmt = '#,##0';
      row.getCell('vatAmount').numFmt = '#,##0';
      row.getCell('discountAmount').numFmt = '#,##0';
      row.getCell('totalAmount').numFmt = '#,##0';
    });

    // Summary Row
    const summaryRow = worksheet.addRow({
      stt: '',
      invoiceNo: 'TỔNG CỘNG',
      serialNo: '',
      invoiceDate: '',
      partnerName: '',
      taxCode: '',
      itemCode: '',
      description: '',
      unit: '',
      quantity: result.summary.totalQuantity,
      unitPrice: '',
      preVatAmount: result.summary.totalPreVatAmount,
      vatRate: '',
      vatAmount: result.summary.totalVatAmount,
      discountAmount: result.summary.totalDiscountAmount,
      totalAmount: result.summary.totalAmount,
      invoiceSubcategory: '',
      status: '',
      postingStatus: '',
    });
    summaryRow.font = { bold: true };
    summaryRow.getCell('quantity').numFmt = '#,##0.00';
    summaryRow.getCell('preVatAmount').numFmt = '#,##0';
    summaryRow.getCell('vatAmount').numFmt = '#,##0';
    summaryRow.getCell('discountAmount').numFmt = '#,##0';
    summaryRow.getCell('totalAmount').numFmt = '#,##0';

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
