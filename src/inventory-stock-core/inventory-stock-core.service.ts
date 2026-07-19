import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { Repository, Like, In, Brackets } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';

@Injectable()
export class InventoryStockCoreService {
  constructor(
    @InjectRepository(ErpInventoryBalance)
    private readonly balanceRepository: Repository<ErpInventoryBalance>,
    @InjectRepository(ErpInventoryItem)
    private readonly itemRepository: Repository<ErpInventoryItem>,
    @InjectRepository(ErpInventoryTransaction)
    private readonly transactionRepository: Repository<ErpInventoryTransaction>,
  ) {}

  async findAll(
    query: PaginationDto & {
      item_type?: string;
      search?: string;
      searches?: string;
      filters?: string;
    },
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.itemRepository.createQueryBuilder('item');
    qb.leftJoin(ErpInventoryBalance, 'b', 'b.itemId = item.id');
    qb.leftJoinAndSelect('item.uom', 'uom');
    qb.leftJoinAndSelect('item.itemType', 'itemType');

    if (query.item_type && query.search) {
      qb.where(
        new Brackets((qbInner) => {
          qbInner
            .where('itemType.code = :type AND item.sku ILIKE :search', {
              type: query.item_type,
              search: `%${query.search}%`,
            })
            .orWhere('itemType.code = :type AND item.itemName ILIKE :search', {
              type: query.item_type,
              search: `%${query.search}%`,
            });
        }),
      );
    } else if (query.item_type) {
      qb.where('itemType.code = :type', { type: query.item_type });
    } else if (query.search) {
      qb.where(
        new Brackets((qbInner) => {
          qbInner
            .where('item.sku ILIKE :search', { search: `%${query.search}%` })
            .orWhere('item.itemName ILIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    if (query.searches) {
      try {
        const searches = JSON.parse(query.searches) as Record<string, string>;
        for (const [col, val] of Object.entries(searches)) {
          if (!val) continue;
          if (col === 'item_code')
            qb.andWhere('item.sku ILIKE :val', { val: `%${val}%` });
          else if (col === 'item_name')
            qb.andWhere('item.itemName ILIKE :val', { val: `%${val}%` });
          else if (col === 'item_type')
            qb.andWhere('itemType.code ILIKE :val', { val: `%${val}%` });
          else if (col === 'status')
            qb.andWhere('item.status ILIKE :val', { val: `%${val}%` });
          else if (col === 'unit')
            qb.andWhere('uom.name ILIKE :val', { val: `%${val}%` });
          else if (col === 'on_hand_qty' && !isNaN(Number(val)))
            qb.andWhere('b.qtyOnHand = :val', { val: Number(val) });
          else if (col === 'reserved_qty' && !isNaN(Number(val)))
            qb.andWhere('b.qtyReserved = :val', { val: Number(val) });
        }
      } catch (e) {}
    }

    if (query.filters) {
      try {
        const filters = JSON.parse(query.filters) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === 'item_type')
            qb.andWhere(`itemType.code IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          else if (col === 'status')
            qb.andWhere(`item.status IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          else if (col === 'item_code')
            qb.andWhere(`item.sku IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          else if (col === 'item_name')
            qb.andWhere(`item.itemName IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          else if (col === 'unit')
            qb.andWhere(`uom.name IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          else if (col === 'on_hand_qty')
            qb.andWhere(`b.qtyOnHand IN (:...vals_${col})`, {
              [`vals_${col}`]: vals.map(Number),
            });
          else if (col === 'reserved_qty')
            qb.andWhere(`b.qtyReserved IN (:...vals_${col})`, {
              [`vals_${col}`]: vals.map(Number),
            });
          else if (col === 'received_qty')
            qb.andWhere(
              `(SELECT COALESCE(SUM("qty_in"), 0) FROM erp_inventory_transactions txn WHERE txn."item_id" = item.id) IN (:...vals_${col})`,
              { [`vals_${col}`]: vals.map(Number) },
            );
          else if (col === 'issued_qty')
            qb.andWhere(
              `(SELECT COALESCE(SUM("qty_out"), 0) FROM erp_inventory_transactions txn WHERE txn."item_id" = item.id) IN (:...vals_${col})`,
              { [`vals_${col}`]: vals.map(Number) },
            );
          else if (col === 'last')
            qb.andWhere(`CAST(b.updatedAt AS TEXT) IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
        }
      } catch (e) {}
    }

    if (query.sort) {
      const sorts = query.sort.split(',');
      let firstSort = true;
      let hasDefaultSort = false;

      for (const s of sorts) {
        if (!s) continue;
        const isDesc = s.startsWith('-');
        const field = isDesc ? s.substring(1) : s;
        const order = isDesc ? 'DESC' : 'ASC';

        let sortField = '';
        if (field === 'item_code') sortField = 'item.sku';
        else if (field === 'item_type') sortField = 'itemType.code';
        else if (field === 'status') sortField = 'item.status';
        else if (field === 'unit') sortField = 'uom.name';
        else if (field === 'item_name') sortField = 'item.itemName';
        else if (field === 'on_hand_qty') sortField = 'b.qtyOnHand';
        else if (field === 'reserved_qty') sortField = 'b.qtyReserved';
        else if (field === 'last') sortField = 'b.updatedAt';
        else if (field === 'received_qty') {
          qb.addSelect(
            '(SELECT COALESCE(SUM("qty_in"), 0) FROM erp_inventory_transactions txn WHERE txn."item_id" = item.id)',
            'receivedQty_sort',
          );
          sortField = '"receivedQty_sort"';
        } else if (field === 'issued_qty') {
          qb.addSelect(
            '(SELECT COALESCE(SUM("qty_out"), 0) FROM erp_inventory_transactions txn WHERE txn."item_id" = item.id)',
            'issuedQty_sort',
          );
          sortField = '"issuedQty_sort"';
        }

        if (sortField) {
          if (firstSort) {
            if (sortField === 'b.updatedAt') {
              qb.addSelect('b.updatedAt').orderBy(
                'b.updatedAt',
                order,
                'NULLS LAST',
              );
              hasDefaultSort = true;
            } else {
              qb.orderBy(sortField, order, 'NULLS LAST');
            }
            firstSort = false;
          } else {
            if (sortField === 'b.updatedAt') {
              qb.addSelect('b.updatedAt').addOrderBy(
                'b.updatedAt',
                order,
                'NULLS LAST',
              );
              hasDefaultSort = true;
            } else {
              qb.addOrderBy(sortField, order, 'NULLS LAST');
            }
          }
        }
      }
      if (firstSort || !hasDefaultSort) {
        if (firstSort) {
          qb.addSelect('b.updatedAt').orderBy(
            'b.updatedAt',
            'DESC',
            'NULLS LAST',
          );
        } else {
          qb.addSelect('b.updatedAt').addOrderBy(
            'b.updatedAt',
            'DESC',
            'NULLS LAST',
          );
        }
      }
    } else {
      qb.addSelect('b.updatedAt').orderBy('b.updatedAt', 'DESC', 'NULLS LAST');
    }

    qb.offset((page - 1) * pageSize).limit(pageSize);

    const items = await qb.getMany();

    const countQb = qb.clone();
    countQb.orderBy(); // clear order by for count query to avoid distinctAlias error
    const total = await countQb.getCount();

    if (items.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const itemIds = items.map((i) => i.id);

    const balances = await this.balanceRepository.find({
      where: { itemId: In(itemIds) },
    });
    const balanceMap = new Map(balances.map((b) => [b.itemId, b]));

    const transactionSums = await this.transactionRepository
      .createQueryBuilder('txn')
      .select('txn.itemId', 'itemId')
      .addSelect('COALESCE(SUM(txn.qtyIn), 0)', 'receivedQty')
      .addSelect('COALESCE(SUM(txn.qtyOut), 0)', 'issuedQty')
      .where('txn.itemId IN (:...itemIds)', { itemIds })
      .groupBy('txn.itemId')
      .getRawMany<{
        itemId: string;
        receivedQty: string;
        issuedQty: string;
      }>();
    const txnMap = new Map(transactionSums.map((row) => [row.itemId, row]));

    const rows = items.map((item) => {
      const b = balanceMap.get(item.id);
      const txn = txnMap.get(item.id);
      return {
        inventory_item_id: item.id,
        branch_id: null,
        item_code: item.sku ?? '',
        item_name: item.itemName ?? '',
        item_type: item.itemType?.code ?? '',
        unit: item.uom?.name ?? '',
        received_qty: Number(txn?.receivedQty || 0),
        issued_qty: Number(txn?.issuedQty || 0),
        on_hand_qty: Number(b?.qtyOnHand || 0),
        reserved_qty: Number(b?.qtyReserved || 0),
        stock_value: Number(b?.inventoryValue || 0),
        last_transaction_date: b?.updatedAt?.toISOString?.() ?? null,
        status: item.status,
      };
    });

    return {
      items: rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filtersStr?: string,
  ) {
    const qb = this.itemRepository.createQueryBuilder('item');
    qb.leftJoin('item.itemType', 'itemType');
    qb.leftJoin('item.uom', 'uom');
    qb.leftJoin(ErpInventoryBalance, 'b', 'b.itemId = item.id');

    let selectField = '';
    if (column === 'item_code') selectField = 'item.sku';
    else if (column === 'item_name') selectField = 'item.itemName';
    else if (column === 'item_type') selectField = 'itemType.code';
    else if (column === 'status') selectField = 'item.status';
    else if (column === 'unit') selectField = 'uom.name';
    else if (column === 'on_hand_qty') selectField = 'b.qtyOnHand';
    else if (column === 'reserved_qty') selectField = 'b.qtyReserved';
    else if (column === 'received_qty') {
      selectField =
        '(SELECT COALESCE(SUM("qty_in"), 0) FROM erp_inventory_transactions txn WHERE txn."item_id" = item.id)';
    } else if (column === 'issued_qty') {
      selectField =
        '(SELECT COALESCE(SUM("qty_out"), 0) FROM erp_inventory_transactions txn WHERE txn."item_id" = item.id)';
    } else if (column === 'last') selectField = 'b.updatedAt';
    else return { items: [], total: 0 };

    qb.select(`DISTINCT ${selectField}`, 'value');
    qb.where(`${selectField} IS NOT NULL`);
    qb.andWhere(`CAST(${selectField} AS TEXT) != ''`);

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue; // DO NOT apply filter for the column we are querying options for!

          if (col === 'item_type')
            qb.andWhere(`itemType.code IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          else if (col === 'status')
            qb.andWhere(`item.status IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          else if (col === 'item_code')
            qb.andWhere(`item.sku IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          else if (col === 'item_name')
            qb.andWhere(`item.itemName IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          else if (col === 'unit')
            qb.andWhere(`uom.name IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          else if (col === 'on_hand_qty')
            qb.andWhere(`b.qtyOnHand IN (:...vals_${col})`, {
              [`vals_${col}`]: vals.map(Number),
            });
          else if (col === 'reserved_qty')
            qb.andWhere(`b.qtyReserved IN (:...vals_${col})`, {
              [`vals_${col}`]: vals.map(Number),
            });
          else if (col === 'received_qty')
            qb.andWhere(
              `(SELECT COALESCE(SUM("qty_in"), 0) FROM erp_inventory_transactions txn WHERE txn."item_id" = item.id) IN (:...vals_${col})`,
              { [`vals_${col}`]: vals.map(Number) },
            );
          else if (col === 'issued_qty')
            qb.andWhere(
              `(SELECT COALESCE(SUM("qty_out"), 0) FROM erp_inventory_transactions txn WHERE txn."item_id" = item.id) IN (:...vals_${col})`,
              { [`vals_${col}`]: vals.map(Number) },
            );
          else if (col === 'last')
            qb.andWhere(`CAST(b.updatedAt AS TEXT) IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
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
      items: results.map((r) => r.value).filter(Boolean),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async exportExcel(
    query: PaginationDto & {
      item_type?: string;
      search?: string;
      searches?: string;
      filters?: string;
    },
  ): Promise<Buffer> {
    const data = await this.findAll({
      ...query,
      page: 1,
      pageSize: 1000000,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('LichSuXuatNhapKho');

    worksheet.columns = [
      { header: 'Mã VT', key: 'item_code', width: 15 },
      { header: 'Tên VT', key: 'item_name', width: 40 },
      { header: 'Loại VT', key: 'item_type', width: 20 },
      { header: 'ĐVT', key: 'unit', width: 15 },
      {
        header: 'Tổng Nhập',
        key: 'received_qty',
        width: 15,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Tổng Xuất',
        key: 'issued_qty',
        width: 15,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Tồn Kho',
        key: 'on_hand_qty',
        width: 15,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Giữ Chỗ',
        key: 'reserved_qty',
        width: 15,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Giá Trị Tồn',
        key: 'stock_value',
        width: 20,
        style: { numFmt: '#,##0' },
      },
      { header: 'Ngày GD Cuối', key: 'last_transaction_date', width: 20 },
      { header: 'Trạng thái', key: 'status', width: 15 },
    ];

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

    for (const row of data.items) {
      let lastTxDate = row.last_transaction_date;
      if (lastTxDate) {
        try {
          const d = new Date(lastTxDate);
          lastTxDate =
            d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN');
        } catch (e) {}
      }
      worksheet.addRow({
        item_code: row.item_code,
        item_name: row.item_name,
        item_type: row.item_type,
        unit: row.unit,
        received_qty: row.received_qty,
        issued_qty: row.issued_qty,
        on_hand_qty: row.on_hand_qty,
        reserved_qty: row.reserved_qty,
        stock_value: row.stock_value,
        last_transaction_date: lastTxDate || '',
        status: row.status,
      });
    }

    if (data.items.length > 0) {
      const itemIds = data.items.map((i) => i.inventory_item_id);
      const txnsRaw = await this.transactionRepository
        .createQueryBuilder('txn')
        .leftJoin('erp_goods_receipts', 'gr', 'gr.id = txn.document_id')
        .leftJoin('erp_goods_issues', 'gi', 'gi.id = txn.document_id')
        .select('txn.*')
        .addSelect('COALESCE(gr.receipt_no, gi.issue_no)', 'document_no')
        .where('txn.item_id IN (:...itemIds)', { itemIds })
        .orderBy('txn.transaction_date', 'ASC')
        .getRawMany();

      const wsTxn = workbook.addWorksheet('LichSuGiaoDich');
      wsTxn.columns = [
        { header: 'Mã VT', key: 'item_code', width: 15 },
        { header: 'Tên VT', key: 'item_name', width: 40 },
        { header: 'Loại GD', key: 'transaction_type', width: 20 },
        { header: 'Ngày GD', key: 'transaction_date', width: 20 },
        { header: 'Số phiếu', key: 'document_no', width: 20 },
        {
          header: 'SL Nhập',
          key: 'qty_in',
          width: 15,
          style: { numFmt: '#,##0' },
        },
        {
          header: 'SL Xuất',
          key: 'qty_out',
          width: 15,
          style: { numFmt: '#,##0' },
        },
        {
          header: 'Tồn',
          key: 'balance',
          width: 15,
          style: { numFmt: '#,##0' },
        },
        {
          header: 'Đơn giá',
          key: 'unit_cost',
          width: 15,
          style: { numFmt: '#,##0' },
        },
        { header: 'Ghi chú', key: 'notes', width: 30 },
      ];

      wsTxn.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      });

      wsTxn.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' },
      ];

      wsTxn.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: wsTxn.columns.length },
      };

      const itemMap = new Map(data.items.map((i) => [i.inventory_item_id, i]));
      const balanceMap = new Map<string, number>();

      for (const t of txnsRaw) {
        const i = itemMap.get(t.item_id || '');
        let tDate = t.transaction_date;
        if (tDate) {
          try {
            const d = new Date(tDate);
            tDate =
              d.toLocaleDateString('vi-VN') +
              ' ' +
              d.toLocaleTimeString('vi-VN');
          } catch (e) {}
        }

        const qIn = Number(t.qty_in || 0);
        const qOut = Number(t.qty_out || 0);

        let currentBalance = balanceMap.get(t.item_id) || 0;
        currentBalance = currentBalance + qIn - qOut;
        balanceMap.set(t.item_id, currentBalance);

        wsTxn.addRow({
          item_code: i?.item_code || '',
          item_name: i?.item_name || '',
          transaction_type: t.transaction_type,
          transaction_date: tDate || '',
          document_no: t.document_no || '',
          qty_in: qIn,
          qty_out: qOut,
          balance: currentBalance,
          unit_cost: Number(t.unit_cost || 0),
          notes: t.notes || '',
        });
      }

      const wsTongHop = workbook.addWorksheet('TongHopGiaoDich');
      wsTongHop.columns = [
        { header: 'Mã VT', key: 'item_code', width: 15 },
        { header: 'Tên VT', key: 'item_name', width: 40 },
        {
          header: 'Tổng Nhập',
          key: 'total_in',
          width: 15,
          style: { numFmt: '#,##0' },
        },
        {
          header: 'Tổng Xuất',
          key: 'total_out',
          width: 15,
          style: { numFmt: '#,##0' },
        },
        {
          header: 'Tồn',
          key: 'balance',
          width: 15,
          style: { numFmt: '#,##0' },
        },
      ];

      wsTongHop.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      });

      wsTongHop.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' },
      ];

      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        const rowNumber = i + 2;
        wsTongHop.addRow({
          item_code: item.item_code,
          item_name: item.item_name,
          total_in: {
            formula: `SUMIF('LichSuGiaoDich'!A:A, A${rowNumber}, 'LichSuGiaoDich'!F:F)`,
          },
          total_out: {
            formula: `SUMIF('LichSuGiaoDich'!A:A, A${rowNumber}, 'LichSuGiaoDich'!G:G)`,
          },
          balance: { formula: `C${rowNumber}-D${rowNumber}` },
        });
      }
    }

    // === NEW SHEET 1: Danh_Sach_Xe_San_Xuat ===
    const wsXe = workbook.addWorksheet('DanhSachXe_Audit');
    wsXe.columns = [
      { header: 'Lệnh SX', key: 'lenh_sx', width: 20 },
      { header: 'Ngày Hoàn Thành', key: 'ngay_hoan_thanh', width: 25 },
      { header: 'Mã Xe', key: 'ma_xe', width: 15 },
      { header: 'Tên Xe', key: 'ten_xe', width: 35 },
      { header: 'Mã BOM', key: 'ma_bom', width: 32 },
      { header: 'Số Serial', key: 'so_serial', width: 20 },
      { header: 'Số Khung', key: 'so_khung', width: 22 },
      { header: 'Số Máy', key: 'so_may', width: 22 },
    ];
    wsXe.getRow(1).eachCell((c) => {
      c.font = { bold: true };
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD6E4F0' },
      };
    });
    wsXe.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }];
    wsXe.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 8 },
    };

    const xeData = await this.itemRepository.manager.query(`
      SELECT 
        po.reference_no AS lenh_sx,
        po.updated_at AS ngay_hoan_thanh,
        i.sku AS ma_xe,
        i.item_name AS ten_xe,
        b.bom_code AS ma_bom,
        s.serial_no AS so_serial,
        v.vin_no AS so_khung,
        v.engine_no AS so_may
      FROM erp_vehicles v
      LEFT JOIN erp_inventory_tracking_serials s ON s.vin_id = v.id
      LEFT JOIN erp_production_orders po ON po.id = s.production_order_id
      LEFT JOIN erp_inventory_items i ON i.id = COALESCE(po.finished_good_item_id, s.item_id)
      LEFT JOIN erp_boms b ON b.id::text = (po.output_metadata->>'bomId')
      ORDER BY po.updated_at DESC NULLS LAST, po.reference_no ASC NULLS LAST, v.vin_no ASC;
    `);

    for (const r of xeData) {
      let ngay = r.ngay_hoan_thanh;
      if (ngay) {
        try {
          const d = new Date(ngay);
          ngay =
            d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN');
        } catch (e) {}
      }
      wsXe.addRow({ ...r, ngay_hoan_thanh: ngay || '' });
    }

    // === NEW SHEET 2: Audit_NVL_Theo_Lenh_SX ===
    const wsNvl = workbook.addWorksheet('VatTu_Audit');
    wsNvl.columns = [
      { header: 'Lệnh SX', key: 'lenh_sx', width: 20 },
      { header: 'Mã Xe', key: 'ma_xe', width: 15 },
      { header: 'Mã BOM', key: 'ma_bom', width: 32 },
      {
        header: 'SL Xe Đã SX',
        key: 'sl_xe_da_sx',
        width: 15,
        style: { numFmt: '#,##0' },
      },
      { header: 'Mã NVL', key: 'ma_nvl', width: 15 },
      { header: 'Tên NVL', key: 'ten_nvl', width: 40 },
      { header: 'ĐVT', key: 'dvt', width: 10 },
      {
        header: 'Định Mức / 1 Xe',
        key: 'dinh_muc',
        width: 18,
        style: { numFmt: '#,##0.####' },
      },
      {
        header: 'SL NVL Cần (Định mức × Xe SX)',
        key: 'sl_nvl_can',
        width: 30,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'SL NVL Đã Xuất',
        key: 'sl_nvl_da_xuat',
        width: 18,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Chênh Lệch',
        key: 'chenh_lech',
        width: 15,
        style: { numFmt: '#,##0.00' },
      },
    ];
    wsNvl.getRow(1).eachCell((c) => {
      c.font = { bold: true };
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD6E4F0' },
      };
    });
    wsNvl.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }];
    wsNvl.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 11 },
    };

    const nvlData = await this.itemRepository.manager.query(`
      SELECT 
        po.reference_no AS lenh_sx,
        fg.sku AS ma_xe,
        b.bom_code AS ma_bom,
        po.qty_produced AS sl_xe_da_sx,
        rm.sku AS ma_nvl,
        rm.item_name AS ten_nvl,
        u.code AS dvt,
        CASE WHEN po.qty_produced > 0 THEN ROUND((m.qty_required / po.qty_produced)::numeric, 4) ELSE 0 END AS dinh_muc,
        m.qty_required AS sl_nvl_can,
        COALESCE(gi_agg.sl_da_xuat, 0) AS sl_nvl_da_xuat,
        (COALESCE(gi_agg.sl_da_xuat, 0) - m.qty_required) AS chenh_lech
      FROM erp_production_order_materials m
      JOIN erp_production_orders po ON m.production_order_id = po.id
      JOIN erp_inventory_items fg ON po.finished_good_item_id = fg.id
      JOIN erp_inventory_items rm ON m.item_id = rm.id
      LEFT JOIN erp_uoms u ON rm.uom_id = u.id
      LEFT JOIN erp_boms b ON b.id::text = (po.output_metadata->>'bomId')
      LEFT JOIN (
        SELECT gi.production_order_id, gil.item_id, SUM(gil.qty_issued) AS sl_da_xuat
        FROM erp_goods_issue_lines gil
        JOIN erp_goods_issues gi ON gi.id = gil.goods_issue_id
        WHERE gi.status = 'POSTED' AND gi.production_order_id IS NOT NULL
        GROUP BY gi.production_order_id, gil.item_id
      ) gi_agg ON gi_agg.production_order_id = po.id AND gi_agg.item_id = m.item_id
      WHERE (po.status = 'COMPLETED' OR po.qty_produced > 0)
      ORDER BY po.updated_at DESC, po.reference_no ASC, rm.sku ASC;
    `);

    for (const r of nvlData) {
      const row = wsNvl.addRow({
        ...r,
        sl_xe_da_sx: Number(r.sl_xe_da_sx),
        dinh_muc: Number(r.dinh_muc),
        sl_nvl_can: Number(r.sl_nvl_can),
        sl_nvl_da_xuat: Number(r.sl_nvl_da_xuat),
        chenh_lech: Number(r.chenh_lech),
      });
      // Tô đỏ dòng có chênh lệch
      const chenhLech = Number(r.chenh_lech);
      if (Math.abs(chenhLech) > 0.001) {
        row.getCell('chenh_lech').font = {
          bold: true,
          color: { argb: 'FFCC0000' },
        };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as any as Buffer;
  }
}
