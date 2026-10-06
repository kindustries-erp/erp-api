import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpInvoiceItem } from '../../entities/erp_invoice_item.entity';
import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../../../common/utils/query-builder.util';
import { parseVatRateForDisplay } from '../../helpers/invoice-mapper.helper';
import {
  _applyItemColumnSearch,
  _applyItemColumnFilters,
} from './invoice-items-query-helpers';

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
export class InvoiceItemsQueryService {
  private readonly logger = new Logger(InvoiceItemsQueryService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    @Optional()
    @InjectRepository(ErpInvoiceItem)
    private readonly itemRepository?: Repository<ErpInvoiceItem>,
  ) {}

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

    _applyItemColumnSearch(qb, columnSearch, query.direction);
    _applyItemColumnFilters(qb, columnFilters, query.direction);

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
          _applyItemColumnFilters(qb, activeFilters, direction);
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
          const label = sec ? (val ? `${val} (${sec})` : `(${sec})`) : val;
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
}
