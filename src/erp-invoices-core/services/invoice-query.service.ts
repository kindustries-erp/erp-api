import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';

import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../../common/utils/query-builder.util';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import {
  toInvoiceDto,
  parseVatRateForDisplay,
} from '../helpers/invoice-mapper.helper';
import type { ErpInvoiceQuery } from '../erp-invoices-core.service';

@Injectable()
export class InvoiceQueryService {
  private readonly logger = new Logger(InvoiceQueryService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
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
    if (column === 'invoiceDate') {
      selectField = "TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')";
      isDateColumn = true;
    } else if (column === 'serialNo') selectField = 'inv.serial_no';
    else if (column === 'invoiceNo') selectField = 'inv.invoice_no';
    else if (column === 'partner') {
      if (direction === 'IN') selectField = 'inv.seller_name';
      else if (direction === 'OUT') selectField = 'inv.buyer_name';
      else
        selectField =
          "(CASE WHEN inv.direction = 'IN' THEN inv.seller_name WHEN inv.direction = 'OUT' THEN inv.buyer_name END)";
    } else if (column === 'taxCode') {
      if (direction === 'IN') selectField = 'inv.seller_tax_code';
      else if (direction === 'OUT') selectField = 'inv.buyer_tax_code';
      else
        selectField =
          "(CASE WHEN inv.direction = 'IN' THEN inv.seller_tax_code WHEN inv.direction = 'OUT' THEN inv.buyer_tax_code END)";
    } else if (column === 'description') selectField = 'inv.description';
    else if (column === 'preVatAmount') selectField = 'inv.pre_vat_amount';
    else if (column === 'vatAmount') selectField = 'inv.vat_amount';
    else if (column === 'discountAmount') selectField = 'inv.discount_amount';
    else if (column === 'totalAmount') selectField = 'inv.total_amount';
    else if (column === 'licensePlate') selectField = 'inv.license_plate';
    else if (column === 'settlementOrder') selectField = 'inv.settlement_order';
    else if (column === 'branchId') selectField = 'inv.branch_id';
    else if (column === 'notes') selectField = 'inv.notes';
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
            else
              filterField =
                "(CASE WHEN inv.direction = 'IN' THEN inv.seller_name WHEN inv.direction = 'OUT' THEN inv.buyer_name END)";
          } else if (col === 'taxCode') {
            if (direction === 'IN') filterField = 'inv.seller_tax_code';
            else if (direction === 'OUT') filterField = 'inv.buyer_tax_code';
            else
              filterField =
                "(CASE WHEN inv.direction = 'IN' THEN inv.seller_tax_code WHEN inv.direction = 'OUT' THEN inv.buyer_tax_code END)";
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
          else if (col === 'notes') filterField = 'inv.notes';

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
      let searchField = `CAST(${selectField} AS TEXT)`;
      let searchKeyword = search;

      if (
        ['preVatAmount', 'vatAmount', 'discountAmount', 'totalAmount'].includes(
          column,
        )
      ) {
        searchField = `REPLACE(REPLACE(CAST(${selectField} AS TEXT), '.', ''), ',', '')`;
        searchKeyword = search.replace(/[,.]/g, '');
      }

      applyMultiKeywordFilter(qb, searchField, searchKeyword, 'search');
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
      query.seller_name ||
      query.buyer_name ||
      query.partner_tax_code ||
      query.tag_id ||
      query.sort_by === 'invoiceNo' ||
      query.sort_by === 'netOffAmount' ||
      query.sort_by === 'remainingAmount' ||
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
      if (query.seller_name)
        qb.andWhere('inv.seller_name ILIKE :sn', {
          sn: `%${query.seller_name}%`,
        });
      if (query.buyer_name)
        qb.andWhere('inv.buyer_name ILIKE :bn', {
          bn: `%${query.buyer_name}%`,
        });
      if (query.partner_tax_code)
        qb.andWhere(
          '(inv.seller_tax_code = :ptc OR inv.buyer_tax_code = :ptc)',
          { ptc: query.partner_tax_code },
        );
      if (query.tag_id)
        qb.andWhere(
          `inv.id IN (SELECT entity_id FROM sys_entity_tags WHERE entity_type = 'erp_invoice' AND tag_id = :tagId)`,
          { tagId: query.tag_id },
        );

      const needsNetOffJoin =
        query.sort_by === 'netOffAmount' ||
        query.sort_by === 'remainingAmount' ||
        columnSearch['netOffAmount'] !== undefined ||
        columnSearch['remainingAmount'] !== undefined;

      if (needsNetOffJoin) {
        qb.leftJoin(
          '(SELECT invoice_id, SUM(net_off_amount) as net_off_sum FROM erp_invoice_voucher_netoff GROUP BY invoice_id)',
          'netoff_agg',
          'netoff_agg.invoice_id = inv.id',
        );
      }

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
        .addOrderBy('inv.createdAt', 'DESC')
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();

      const mappedItems = await this._loadNetOffAmounts(searchResults[0]);
      return {
        items: mappedItems.map((i: any) => toInvoiceDto(i)),
        total: searchResults[1],
        page,
        pageSize,
        totalPages: Math.ceil(searchResults[1] / pageSize),
      };
    }

    const [items, total] = await this.repository.findAndCount({
      where,
      relations: ['items', 'attachments', 'attachments.attachment'],
      order: { [orderProperty]: orderDirection, createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const mappedItems = await this._loadNetOffAmounts(items);
    return {
      items: mappedItems.map((i: any) => toInvoiceDto(i)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ---------------------------------------------------------------------------
  // Excel export — replicates findAll filter logic then writes spreadsheet
  // ---------------------------------------------------------------------------

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
      columnSearch['remainingAmount'] !== undefined;

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
    items = await this._loadNetOffAmounts(items);

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

    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('Bảng kê');
    summarySheet.columns = [
      { header: 'Ngày phát hành', key: 'invoiceDate', width: 15 },
      { header: 'Ký hiệu hóa đơn', key: 'serialNo', width: 15 },
      { header: 'Số hóa đơn', key: 'invoiceNo', width: 15 },
      { header: 'Tên đơn vị khách hàng', key: 'partnerName', width: 40 },
      { header: 'MST khách hàng', key: 'taxCode', width: 15 },
      { header: 'Địa chỉ khách hàng', key: 'address', width: 50 },
      {
        header: 'Trước thuế GTGT',
        key: 'preVat',
        width: 20,
        style: { numFmt: '#,##0' },
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
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Thành tiền',
        key: 'total',
        width: 20,
        style: { numFmt: '#,##0' },
      },
      { header: 'Biển số xe', key: 'licensePlate', width: 15 },
      { header: 'Lệnh quyết toán', key: 'wo', width: 30 },
      { header: 'Diễn giải', key: 'description', width: 50 },
      { header: 'Trạng thái', key: 'statusName', width: 20 },
      {
        header: 'Đã cấn trừ',
        key: 'netOffAmount',
        width: 20,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Tham chiếu cấn trừ',
        key: 'netOffReferences',
        width: 30,
      },
      {
        header: 'Còn lại',
        key: 'remainingAmount',
        width: 20,
        style: { numFmt: '#,##0' },
      },
      { header: 'Chi nhánh', key: 'branchName', width: 25 },
    ];

    const detailedSheet = workbook.addWorksheet('Hàng hóa');
    detailedSheet.columns = [
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
        header: 'Trước thuế GTGT',
        key: 'preVatAmount',
        width: 20,
        style: { numFmt: '#,##0' },
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
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Thành tiền',
        key: 'totalAmount',
        width: 20,
        style: { numFmt: '#,##0' },
      },
      { header: 'Biển số xe', key: 'licensePlate', width: 15 },
      { header: 'Lệnh quyết toán', key: 'wo', width: 30 },
      { header: 'Diễn giải', key: 'description', width: 50 },
      { header: 'Trạng thái', key: 'statusName', width: 20 },
      {
        header: 'Đã cấn trừ',
        key: 'netOffAmount',
        width: 20,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Tham chiếu cấn trừ',
        key: 'netOffReferences',
        width: 30,
      },
      {
        header: 'Còn lại',
        key: 'remainingAmount',
        width: 20,
        style: { numFmt: '#,##0' },
      },
      { header: 'Chi nhánh', key: 'branchName', width: 25 },
    ];

    const applyHeaderStyle = (sheet) => {
      sheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      });
      sheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' },
      ];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columns.length },
      };
    };

    applyHeaderStyle(summarySheet);
    applyHeaderStyle(detailedSheet);

    for (const inv of items) {
      const partnerName =
        query.direction === 'IN' ? inv.sellerName : inv.buyerName;
      const taxCode =
        query.direction === 'IN' ? inv.sellerTaxCode : inv.buyerTaxCode;
      const address =
        query.direction === 'IN' ? inv.sellerAddress : inv.buyerAddress;
      const branchName = inv.branchId ? branchMap[inv.branchId] : '';
      const remainingAmount =
        Number(inv.totalAmount || 0) - Number((inv as any).netOffAmount || 0);

      const fullDesc = [
        inv.description,
        (inv as any).notes,
        ...(inv.items || []).map((i) => i.description),
      ]
        .filter(Boolean)
        .join(' | ');

      const statusName = formatTaxInvoiceStatus(inv.taxInvoiceStatus);

      summarySheet.addRow({
        invoiceDate: inv.invoiceDate,
        serialNo: inv.serialNo,
        invoiceNo: inv.invoiceNo,
        partnerName,
        taxCode,
        address,
        preVat: Number(inv.preVatAmount) || 0,
        vatRate: parseVatRateForDisplay(inv.vatRate),
        vat: Number(inv.vatAmount) || 0,
        total: Number(inv.totalAmount) || 0,
        licensePlate: inv.licensePlate || '',
        wo: inv.settlementOrder || '',
        description: fullDesc,
        statusName: formatTaxInvoiceStatus(inv.taxInvoiceStatus),
        netOffAmount: Number((inv as any).netOffAmount) || 0,
        netOffReferences: (inv as any).netOffReferences || '',
        remainingAmount:
          Number(inv.totalAmount) - (Number((inv as any).netOffAmount) || 0),
        branchName: branchMap[inv.branchId || ''] || '',
      });

      if (!inv.items || inv.items.length === 0) {
        detailedSheet.addRow({
          invoiceDate: inv.invoiceDate,
          serialNo: inv.serialNo,
          invoiceNo: inv.invoiceNo,
          partnerName,
          taxCode,
          itemName: inv.description || '',
          uom: '',
          qty: 0,
          unitPrice: 0,
          preVatAmount: Number(inv.preVatAmount) || 0,
          vatRate: parseVatRateForDisplay(inv.vatRate),
          vatAmount: Number(inv.vatAmount) || 0,
          totalAmount: Number(inv.totalAmount) || 0,
          licensePlate: inv.licensePlate || '',
          wo: inv.settlementOrder || '',
          description: fullDesc,
          statusName: formatTaxInvoiceStatus(inv.taxInvoiceStatus),
          netOffAmount: Number((inv as any).netOffAmount) || 0,
          netOffReferences: (inv as any).netOffReferences || '',
          remainingAmount:
            Number(inv.totalAmount) - (Number((inv as any).netOffAmount) || 0),
          branchName: branchMap[inv.branchId || ''] || '',
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
            Number(item.totalAmount) || Math.round(itemPreVat + itemVatAmount);

          detailedSheet.addRow({
            invoiceDate: inv.invoiceDate,
            serialNo: inv.serialNo,
            invoiceNo: inv.invoiceNo,
            partnerName,
            taxCode,
            itemName: item.description || '',
            uom: item.unit || '',
            qty: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            preVatAmount: itemPreVat,
            vatRate: itemVatRateRaw,
            vatAmount: itemVatAmount,
            totalAmount: itemTotalAmount,
            licensePlate: inv.licensePlate || '',
            wo: inv.settlementOrder || '',
            description: fullDesc,
            statusName: formatTaxInvoiceStatus(inv.taxInvoiceStatus),
            netOffAmount: Number((inv as any).netOffAmount) || 0,
            netOffReferences: (inv as any).netOffReferences || '',
            remainingAmount:
              Number(inv.totalAmount) -
              (Number((inv as any).netOffAmount) || 0),
            branchName: branchMap[inv.branchId || ''] || '',
          });
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
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
    const netOffs = await this.repository.manager
      .createQueryBuilder('erp_invoice_voucher_netoff', 'netoff')
      .select('netoff.invoice_id', 'invoiceId')
      .addSelect('SUM(netoff.net_off_amount)', 'sum')
      .addSelect("STRING_AGG(DISTINCT bt.reference_number, ', ')", 'refNos')
      .leftJoin(
        'erp_bank_transactions',
        'bt',
        'bt.id = netoff.bank_transaction_id',
      )
      .where('netoff.invoice_id IN (:...ids)', { ids })
      .groupBy('netoff.invoice_id')
      .getRawMany();

    const netOffMap = netOffs.reduce(
      (acc, curr) => {
        acc[curr.invoiceId] = {
          sum: Number(curr.sum) || 0,
          refNos: curr.refNos || '',
        };
        return acc;
      },
      {} as Record<string, { sum: number; refNos: string }>,
    );

    return invoices.map((i) => ({
      ...i,
      netOffAmount: String(netOffMap[i.id]?.sum || 0),
      netOffReferences: netOffMap[i.id]?.refNos || '',
    }));
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
        applyMultiKeywordFilter(qb, 'inv.invoice_no', val, 'invoiceNoSearch');
      } else if (key === 'serialNo') {
        applyMultiKeywordFilter(qb, 'inv.serial_no', val, 'serialNoSearch');
      } else if (key === 'partner') {
        if (direction === 'IN') {
          applyMultiKeywordFilter(qb, 'inv.seller_name', val, 'partnerSearch');
        } else if (direction === 'OUT') {
          applyMultiKeywordFilter(qb, 'inv.buyer_name', val, 'partnerSearch');
        } else {
          applyMultiKeywordMultiFieldFilter(
            qb,
            ['inv.seller_name', 'inv.buyer_name'],
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
        if (vals[0] === '__ALL_MATCHING__') {
          const searchStr = vals[1] || '';
          if (searchStr) {
            qb.andWhere('inv.invoice_no ILIKE :invoiceNoSearch', {
              invoiceNoSearch: `%${searchStr}%`,
            });
          }
        } else {
          qb.andWhere('inv.invoice_no IN (:...invoiceNoVals)', {
            invoiceNoVals: vals,
          });
        }
      } else if (key === 'partner') {
        const hasBlank = vals.includes('__BLANK__');
        const realVals = vals.filter((v) => v !== '__BLANK__');
        const fieldMap: any = { IN: 'inv.seller_name', OUT: 'inv.buyer_name' };
        const field = direction
          ? fieldMap[direction]
          : "(CASE WHEN inv.direction = 'IN' THEN inv.seller_name WHEN inv.direction = 'OUT' THEN inv.buyer_name END)";

        if (hasBlank && realVals.length > 0) {
          qb.andWhere(
            `(${field} IN (:...partnerVals) OR ${field} IS NULL OR CAST(${field} AS TEXT) = '')`,
            { partnerVals: realVals },
          );
        } else if (hasBlank) {
          qb.andWhere(`(${field} IS NULL OR CAST(${field} AS TEXT) = '')`);
        } else {
          qb.andWhere(`${field} IN (:...partnerVals)`, { partnerVals: vals });
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
        if (vals[0] === '__ALL_MATCHING__') {
          const s = (vals[1] || '').replace(/[,.]/g, '');
          if (s)
            qb.andWhere(
              "REPLACE(REPLACE(CAST(inv.pre_vat_amount AS TEXT), '.', ''), ',', '') ILIKE :preVatSearch",
              { preVatSearch: `%${s}%` },
            );
        } else {
          qb.andWhere('CAST(inv.pre_vat_amount AS TEXT) IN (:...preVatVals)', {
            preVatVals: vals,
          });
        }
      } else if (key === 'vatAmount') {
        if (vals[0] === '__ALL_MATCHING__') {
          const s = (vals[1] || '').replace(/[,.]/g, '');
          if (s)
            qb.andWhere(
              "REPLACE(REPLACE(CAST(inv.vat_amount AS TEXT), '.', ''), ',', '') ILIKE :vatSearch",
              { vatSearch: `%${s}%` },
            );
        } else {
          qb.andWhere('CAST(inv.vat_amount AS TEXT) IN (:...vatVals)', {
            vatVals: vals,
          });
        }
      } else if (key === 'discountAmount') {
        if (vals[0] === '__ALL_MATCHING__') {
          const s = (vals[1] || '').replace(/[,.]/g, '');
          if (s)
            qb.andWhere(
              "REPLACE(REPLACE(CAST(inv.discount_amount AS TEXT), '.', ''), ',', '') ILIKE :discountSearch",
              { discountSearch: `%${s}%` },
            );
        } else {
          qb.andWhere(
            'CAST(inv.discount_amount AS TEXT) IN (:...discountVals)',
            {
              discountVals: vals,
            },
          );
        }
      } else if (key === 'totalAmount') {
        if (vals[0] === '__ALL_MATCHING__') {
          const s = (vals[1] || '').replace(/[,.]/g, '');
          if (s)
            qb.andWhere(
              "REPLACE(REPLACE(CAST(inv.total_amount AS TEXT), '.', ''), ',', '') ILIKE :totalSearch",
              { totalSearch: `%${s}%` },
            );
        } else {
          qb.andWhere('CAST(inv.total_amount AS TEXT) IN (:...totalVals)', {
            totalVals: vals,
          });
        }
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
      } else if (key === 'taxProcessStatus')
        qb.andWhere('inv.tax_process_status IN (:...taxProcessStatusVals)', {
          taxProcessStatusVals: vals
            .map((v) => parseInt(v, 10))
            .filter((v) => !isNaN(v)),
        });
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
}
