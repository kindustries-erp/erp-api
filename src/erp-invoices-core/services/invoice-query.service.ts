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
      relations: ['items'],
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

    this._applyColumnSearchSimple(qb, columnSearch, query.direction);
    this._applyColumnFiltersExport(qb, columnFilters, query.direction);

    let orderColumn = 'inv.invoiceDate';
    let orderDirection: 'ASC' | 'DESC' = 'DESC';
    if (query.sort_by) {
      const col = this._mapSortByToQbColumn(query.sort_by, query.direction);
      if (col) orderColumn = col;
    }
    if (query.sort_order)
      orderDirection = query.sort_order.toUpperCase() as 'ASC' | 'DESC';

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

      if (isDetailed) {
        if (!inv.items || inv.items.length === 0) {
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
            vatRate: parseVatRateForDisplay(inv.vatRate),
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
              vatRate: parseVatRateForDisplay(item.vatRate || inv.vatRate),
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
          val,
          'preVatSearch',
        );
      } else if (key === 'vatAmount') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(inv.vat_amount AS TEXT), '.', ''), ',', '')",
          val,
          'vatSearch',
        );
      } else if (key === 'discountAmount') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(inv.discount_amount AS TEXT), '.', ''), ',', '')",
          val,
          'discountSearch',
        );
      } else if (key === 'totalAmount') {
        applyMultiKeywordFilter(
          qb,
          "REPLACE(REPLACE(CAST(inv.total_amount AS TEXT), '.', ''), ',', '')",
          val,
          'totalSearch',
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
      }
    });
  }

  /** Simpler ILIKE version used by exportExcel (no multi-keyword needed) */
  private _applyColumnSearchSimple(
    qb: any,
    columnSearch: Record<string, string>,
    direction?: string,
  ) {
    Object.keys(columnSearch).forEach((key) => {
      const val = columnSearch[key];
      if (!val) return;
      const pat = `%${val}%`;

      if (key === 'invoiceNo')
        qb.andWhere('inv.invoice_no ILIKE :invoiceNoSearch', {
          invoiceNoSearch: pat,
        });
      else if (key === 'serialNo')
        qb.andWhere('inv.serial_no ILIKE :serialNoSearch', {
          serialNoSearch: pat,
        });
      else if (key === 'partner') {
        if (direction === 'IN')
          qb.andWhere('inv.seller_name ILIKE :partnerSearch', {
            partnerSearch: pat,
          });
        else if (direction === 'OUT')
          qb.andWhere('inv.buyer_name ILIKE :partnerSearch', {
            partnerSearch: pat,
          });
        else
          qb.andWhere(
            '(inv.seller_name ILIKE :partnerSearch OR inv.buyer_name ILIKE :partnerSearch)',
            { partnerSearch: pat },
          );
      } else if (key === 'taxCode') {
        if (direction === 'IN')
          qb.andWhere('inv.seller_tax_code ILIKE :taxCodeSearch', {
            taxCodeSearch: pat,
          });
        else if (direction === 'OUT')
          qb.andWhere('inv.buyer_tax_code ILIKE :taxCodeSearch', {
            taxCodeSearch: pat,
          });
        else
          qb.andWhere(
            '(inv.seller_tax_code ILIKE :taxCodeSearch OR inv.buyer_tax_code ILIKE :taxCodeSearch)',
            { taxCodeSearch: pat },
          );
      } else if (key === 'description')
        qb.andWhere('inv.description ILIKE :descSearch', { descSearch: pat });
      else if (key === 'preVatAmount')
        qb.andWhere(
          "REPLACE(REPLACE(CAST(inv.pre_vat_amount AS TEXT), '.', ''), ',', '') ILIKE :preVatSearch",
          { preVatSearch: pat },
        );
      else if (key === 'vatAmount')
        qb.andWhere(
          "REPLACE(REPLACE(CAST(inv.vat_amount AS TEXT), '.', ''), ',', '') ILIKE :vatSearch",
          { vatSearch: pat },
        );
      else if (key === 'discountAmount')
        qb.andWhere(
          "REPLACE(REPLACE(CAST(inv.discount_amount AS TEXT), '.', ''), ',', '') ILIKE :discountSearch",
          { discountSearch: pat },
        );
      else if (key === 'totalAmount')
        qb.andWhere(
          "REPLACE(REPLACE(CAST(inv.total_amount AS TEXT), '.', ''), ',', '') ILIKE :totalSearch",
          { totalSearch: pat },
        );
      else if (key === 'settlementOrder')
        qb.andWhere('inv.settlement_order ILIKE :settlementSearch', {
          settlementSearch: pat,
        });
      else if (key === 'licensePlate')
        qb.andWhere('inv.license_plate ILIKE :plateSearch', {
          plateSearch: pat,
        });
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
      else if (key === 'branchId')
        qb.andWhere('inv.branch_id IN (:...branchVals)', { branchVals: vals });
      else if (key === 'invoiceDate')
        qb.andWhere(
          `TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') IN (:...invoiceDateVals)`,
          { invoiceDateVals: vals },
        );
      else if (key === 'serialNo')
        qb.andWhere('inv.serial_no IN (:...serialNoVals)', {
          serialNoVals: vals,
        });
      else if (key === 'invoiceNo')
        qb.andWhere('inv.invoice_no IN (:...invoiceNoVals)', {
          invoiceNoVals: vals,
        });
      else if (key === 'partner') {
        if (direction === 'IN')
          qb.andWhere('inv.seller_name IN (:...partnerVals)', {
            partnerVals: vals,
          });
        else if (direction === 'OUT')
          qb.andWhere('inv.buyer_name IN (:...partnerVals)', {
            partnerVals: vals,
          });
        else
          qb.andWhere(
            "(CASE WHEN inv.direction = 'IN' THEN inv.seller_name WHEN inv.direction = 'OUT' THEN inv.buyer_name END) IN (:...partnerVals)",
            { partnerVals: vals },
          );
      } else if (key === 'taxCode') {
        if (direction === 'IN')
          qb.andWhere('inv.seller_tax_code IN (:...taxCodeVals)', {
            taxCodeVals: vals,
          });
        else if (direction === 'OUT')
          qb.andWhere('inv.buyer_tax_code IN (:...taxCodeVals)', {
            taxCodeVals: vals,
          });
        else
          qb.andWhere(
            "(CASE WHEN inv.direction = 'IN' THEN inv.seller_tax_code WHEN inv.direction = 'OUT' THEN inv.buyer_tax_code END) IN (:...taxCodeVals)",
            { taxCodeVals: vals },
          );
      } else if (key === 'description')
        qb.andWhere('inv.description IN (:...descVals)', { descVals: vals });
      else if (key === 'isValid') {
        const validFilter = vals.includes('true') || vals.includes('1');
        const invalidFilter = vals.includes('false') || vals.includes('0');
        if (validFilter && !invalidFilter) qb.andWhere('inv.is_valid = true');
        else if (invalidFilter && !validFilter)
          qb.andWhere('inv.is_valid = false');
      } else if (key === 'preVatAmount')
        qb.andWhere('CAST(inv.pre_vat_amount AS TEXT) IN (:...preVatVals)', {
          preVatVals: vals,
        });
      else if (key === 'vatAmount')
        qb.andWhere('CAST(inv.vat_amount AS TEXT) IN (:...vatVals)', {
          vatVals: vals,
        });
      else if (key === 'discountAmount')
        qb.andWhere('CAST(inv.discount_amount AS TEXT) IN (:...discountVals)', {
          discountVals: vals,
        });
      else if (key === 'totalAmount')
        qb.andWhere('CAST(inv.total_amount AS TEXT) IN (:...totalVals)', {
          totalVals: vals,
        });
      else if (key === 'settlementOrder')
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
            "(inv.pdf_file_key IS NOT NULL OR (inv.pdf_files IS NOT NULL AND inv.pdf_files::text != '[]' AND inv.pdf_files::text != 'null'))",
          );
        if (vals.includes('has_xml'))
          conditions.push('inv.xml_file_key IS NOT NULL');
        if (vals.includes('no_pdf'))
          conditions.push(
            "(inv.pdf_file_key IS NULL AND (inv.pdf_files IS NULL OR inv.pdf_files::text = '[]' OR inv.pdf_files::text = 'null'))",
          );
        if (vals.includes('no_xml'))
          conditions.push('inv.xml_file_key IS NULL');
        if (conditions.length > 0) qb.andWhere(`(${conditions.join(' OR ')})`);
      } else if (key === 'taxInvoiceType')
        qb.andWhere('inv.tax_invoice_type IN (:...taxInvoiceTypeVals)', {
          taxInvoiceTypeVals: vals,
        });
      else if (key === 'taxInvoiceStatus')
        qb.andWhere('inv.tax_invoice_status IN (:...taxInvoiceStatusVals)', {
          taxInvoiceStatusVals: vals
            .map((v) => parseInt(v, 10))
            .filter((v) => !isNaN(v)),
        });
      else if (key === 'taxProcessStatus')
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
