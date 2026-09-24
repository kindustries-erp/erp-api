import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpEntityAttributeValue } from '../../../module-config/entities/erp_entity_attribute_value.entity';
import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../../../common/utils/query-builder.util';
import { toInvoiceDto } from '../../helpers/invoice-mapper.helper';
import type { ErpInvoiceQuery } from '../../erp-invoices-core.service';
import {
  _loadNetOffAmounts,
  _applyColumnSearch,
  _applyColumnFilters,
} from './invoice-query-helpers';

@Injectable()
export class InvoiceListQueryService {
  private readonly logger = new Logger(InvoiceListQueryService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    @InjectRepository(ErpEntityAttributeValue)
    private readonly entityAttrValueRepo: Repository<ErpEntityAttributeValue>,
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
          _applyColumnFilters(qb, activeFilters, direction);
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
          const label = sec ? (val ? `${val} (${sec})` : `(${sec})`) : val;
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

    _applyColumnSearch(qb, columnSearch, query.direction);
    _applyColumnFilters(qb, columnFilters, query.direction);

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

    const mappedItems = await _loadNetOffAmounts(
      this.repository.manager,
      searchResults[0],
    );
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
}
