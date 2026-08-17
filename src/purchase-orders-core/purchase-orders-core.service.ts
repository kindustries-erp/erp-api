import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import {
  DataSource,
  DeepPartial,
  ILike,
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  In,
  Not,
} from 'typeorm';
import { OperationalQueryDto } from '../operational-documents/dto/operational-document.dto';
import { ErpPurchaseOrder } from './entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from './entities/erp_purchase_order_line.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ErpGoodsReceipt } from '../goods-receipts-core/entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from '../goods-receipts-core/entities/erp_goods_receipt_line.entity';
import { ErpInvoice } from '../erp-invoices-core/entities/erp_invoice.entity';
import { resolveSortOrder } from '../common/utils/sort.util';
import { DocumentDependenciesCoreService } from '../document-dependencies-core/document-dependencies-core.service';

@Injectable()
export class PurchaseOrdersCoreService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpPurchaseOrder)
    private readonly repository: Repository<ErpPurchaseOrder>,
    @InjectRepository(ErpPurchaseOrderLine)
    private readonly lineRepository: Repository<ErpPurchaseOrderLine>,
    private readonly dependencyService: DocumentDependenciesCoreService,
    private readonly companyProfileService: CompanyProfileService,
  ) {}

  private async generateMonthlyPoNo(manager: any, orderDate?: string) {
    const baseDate = orderDate ? new Date(orderDate) : new Date();
    const year = baseDate.getUTCFullYear();
    const month = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    const prefix = `PO-${year}${month}-`;
    const latest = await manager
      .getRepository(ErpPurchaseOrder)
      .createQueryBuilder('po')
      .where('po.poNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('po.poNo', 'DESC')
      .getOne();
    const latestSeq = latest?.poNo?.slice(prefix.length) ?? '000';
    const nextSeq = String(Number(latestSeq || '0') + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }

  async getNextPoNo(date?: string): Promise<{ nextNo: string }> {
    const nextNo = await this.dataSource.transaction((manager) =>
      this.generateMonthlyPoNo(manager, date),
    );
    return { nextNo };
  }

  async create(dto: CreatePurchaseOrderDto) {
    const { lines = [], ...header } = dto;

    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(ErpPurchaseOrder);
      const lineRepo = manager.getRepository(ErpPurchaseOrderLine);
      const poNo =
        header.poNo?.trim() ||
        (await this.generateMonthlyPoNo(manager, header.orderDate));
      const headerPayload: DeepPartial<ErpPurchaseOrder> = {
        ...header,
        poNo,
        status: header.status ?? 'DRAFT',
      };
      const data = await headerRepo.save(headerPayload);
      const savedLines: ErpPurchaseOrderLine[] = [];
      let lineNo = 1;
      for (const line of lines) {
        const linePayload: DeepPartial<ErpPurchaseOrderLine> = {
          purchaseOrderId: data.id,
          lineNo: lineNo++,
          itemId: line.itemId ?? null,
          itemCode: line.itemCode ?? null,
          itemName: line.itemName ?? null,
          description: line.description ?? null,
          qtyOrdered: line.qtyOrdered,
          qtyReceived: '0',
          unitPrice: line.unitPrice ?? null,
          amount: line.amount ?? null,
        };
        const saved = await lineRepo.save(linePayload);
        savedLines.push(saved);
      }
      return {
        message: 'Tạo thành công',
        data: this.toCoreDocument({ ...data, lines: savedLines } as any),
      };
    });
  }

  async getColumnOptions(
    column: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    const qb = this.repository.createQueryBuilder('po');
    qb.leftJoin('po.supplier', 'supplier');
    qb.where('po.isDeleted = false');

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr);
        Object.entries(filters).forEach(([key, values]) => {
          if (Array.isArray(values) && values.length > 0) {
            const paramName = `filter_${key}`;
            if (key === 'poNo')
              qb.andWhere(`po.poNo IN (:${paramName})`, {
                [paramName]: values,
              });
            else if (key === 'status')
              qb.andWhere(`po.status IN (:${paramName})`, {
                [paramName]: values,
              });
            else if (key === 'paymentStatus')
              qb.andWhere(`po.paymentStatus IN (:${paramName})`, {
                [paramName]: values,
              });
            else if (key === 'supplierNameSnapshot')
              qb.andWhere(`supplier.name IN (:${paramName})`, {
                [paramName]: values,
              });
            else if (key === 'orderDate')
              qb.andWhere(
                `TO_CHAR(po.orderDate, 'YYYY-MM-DD') IN (:${paramName})`,
                { [paramName]: values },
              );
            else if (key === 'expectedDate')
              qb.andWhere(
                `TO_CHAR(po.expectedDate, 'YYYY-MM-DD') IN (:${paramName})`,
                { [paramName]: values },
              );
            else if (key === 'title')
              qb.andWhere(`po.title IN (:${paramName})`, {
                [paramName]: values,
              });
            else if (key === 'totalAmount')
              qb.andWhere(`po.totalAmount IN (:${paramName})`, {
                [paramName]: values,
              });
          }
        });
      } catch (e) {}
    }

    let field = '';
    let isDate = false;
    let isNumeric = false;

    switch (column) {
      case 'poNo':
        field = 'po.poNo';
        break;
      case 'status':
        field = 'po.status';
        break;
      case 'paymentStatus':
        field = 'po.paymentStatus';
        break;
      case 'supplierNameSnapshot':
        field = 'supplier.name';
        break;
      case 'orderDate':
        field = 'po.orderDate';
        isDate = true;
        break;
      case 'expectedDate':
        field = 'po.expectedDate';
        isDate = true;
        break;
      case 'title':
        field = 'po.title';
        break;
      case 'remarks':
        field = 'po.remarks';
        break;
      case 'totalAmount':
        field = 'po.totalAmount';
        isNumeric = true;
        break;
      default:
        return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const selectExpr = isDate ? `TO_CHAR(${field}, 'YYYY-MM-DD')` : field;
    qb.select(`DISTINCT ${selectExpr}`, 'val');
    qb.andWhere(`${field} IS NOT NULL`);

    if (search) {
      if (isNumeric) {
        qb.andWhere(`CAST(${field} AS TEXT) ILIKE :search`, {
          search: `%${search}%`,
        });
      } else {
        qb.andWhere(`${selectExpr} ILIKE :search`, { search: `%${search}%` });
      }
    }

    qb.orderBy('val', 'ASC');
    qb.limit(pageSize);
    qb.offset((page - 1) * pageSize);

    const raw = await qb.getRawMany();
    const items = raw.map((r) => {
      const val = (r as Record<string, unknown>).val;
      if (typeof val === 'string') return val;
      if (typeof val === 'number') return val.toString();
      if (typeof val === 'boolean') return val ? 'true' : 'false';
      if (val instanceof Date) return val.toISOString();
      return '';
    });

    // Get total
    const countQb = qb.clone();
    countQb.select(`COUNT(DISTINCT ${selectExpr})`, 'cnt');
    countQb.orderBy();
    countQb.limit();
    countQb.offset();
    const countRaw = await countQb.getRawOne();
    const total = parseInt(countRaw?.cnt || '0', 10);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findAll(query: OperationalQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: any = { isDeleted: false };

    if (query.column_search) {
      try {
        const searches = JSON.parse(query.column_search);
        Object.entries(searches).forEach(([key, val]) => {
          if (val) {
            const strVal = val as string;
            if (key === 'poNo') where.poNo = ILike(`%${strVal}%`);
            else if (key === 'supplierNameSnapshot')
              where.supplier = {
                ...where.supplier,
                name: ILike(`%${strVal}%`),
              };
            else if (key === 'status') where.status = ILike(`%${strVal}%`);
            else if (key === 'paymentStatus')
              where.paymentStatus = ILike(`%${strVal}%`);
            else if (key === 'title') where.title = ILike(`%${strVal}%`);
            else if (key === 'remarks') where.remarks = ILike(`%${strVal}%`);
            else if (key === 'orderDate' || key === 'expectedDate') {
              if (strVal.includes('|')) {
                const [from, to] = strVal.split('|');
                if (from && to) {
                  where[key] = Between(
                    new Date(`${from}T00:00:00.000+07:00`),
                    new Date(`${to}T23:59:59.999+07:00`),
                  );
                } else if (from) {
                  where[key] = MoreThanOrEqual(
                    new Date(`${from}T00:00:00.000+07:00`),
                  );
                } else if (to) {
                  where[key] = LessThanOrEqual(
                    new Date(`${to}T23:59:59.999+07:00`),
                  );
                }
              }
            }
          }
        });
      } catch (e) {}
    }

    if (query.column_filters) {
      try {
        const filters = JSON.parse(query.column_filters);
        Object.entries(filters).forEach(([key, values]) => {
          if (Array.isArray(values) && values.length > 0) {
            if (key === 'poNo') where.poNo = In(values);
            else if (key === 'status') where.status = In(values);
            else if (key === 'paymentStatus') where.paymentStatus = In(values);
            else if (key === 'supplierNameSnapshot')
              where.supplier = { ...where.supplier, name: In(values) };
            else if (key === 'title') where.title = In(values);
            else if (key === 'remarks') where.remarks = In(values);
            // orderDate, expectedDate, totalAmount can be handled dynamically using query builder,
            // but for simplicity with findAndCount we map exact values.
            // Note: date fields require special handling if they have time.
          }
        });
      } catch (e) {}
    }

    if (query.status) {
      where.status = query.status;
    }
    if ((query as any).exclude_status) {
      where.status = Not((query as any).exclude_status);
    }
    if (query.payment_status) {
      where.paymentStatus = query.payment_status;
    }
    if (query.supplier_id) {
      where.supplierId = query.supplier_id;
    }
    if (query.date_from && query.date_to) {
      where.orderDate = Between(
        new Date(`${query.date_from}T00:00:00.000+07:00`),
        new Date(`${query.date_to}T23:59:59.999+07:00`),
      );
    } else if (query.date_from) {
      where.orderDate = MoreThanOrEqual(
        new Date(`${query.date_from}T00:00:00.000+07:00`),
      );
    } else if (query.date_to) {
      where.orderDate = LessThanOrEqual(
        new Date(`${query.date_to}T23:59:59.999+07:00`),
      );
    }

    if (query.inventory_item_id) {
      const poLinesWithItem = await this.lineRepository.find({
        select: ['purchaseOrderId'],
        where: { itemId: query.inventory_item_id },
      });
      const poIds = poLinesWithItem.map((l) => l.purchaseOrderId);
      if (poIds.length === 0) {
        return { items: [], total: 0, page, pageSize, totalPages: 0 };
      }
      where.id = In(poIds);
    }

    if ((query as any).tag_id) {
      const taggedRows = await this.dataSource.query(
        `SELECT entity_id FROM sys_entity_tags WHERE entity_type = 'erp_purchase_order' AND tag_id = $1`,
        [(query as any).tag_id],
      );
      const taggedIds = taggedRows.map((r: any) => r.entity_id);
      if (taggedIds.length === 0) {
        return { items: [], total: 0, page, pageSize, totalPages: 0 };
      }
      where.id = where.id
        ? In(
            taggedIds.filter((id: string) =>
              (where.id as any)._value?.includes(id),
            ),
          )
        : In(taggedIds);
    }

    if (query.only_receivable) {
      const receivableLines = await this.lineRepository
        .createQueryBuilder('line')
        .select('line.purchaseOrderId', 'purchaseOrderId')
        .where(
          'CAST(line.qtyOrdered AS NUMERIC) > CAST(line.qtyReceived AS NUMERIC)',
        )
        .getRawMany();

      const receivablePoIds = receivableLines.map((l) => l.purchaseOrderId);
      if (receivablePoIds.length === 0) {
        return { items: [], total: 0, page, pageSize, totalPages: 0 };
      }
      where.id = where.id
        ? In(
            receivablePoIds.filter((id: string) =>
              (where.id as any)._value?.includes(id),
            ),
          )
        : In(receivablePoIds);
    }

    const order = resolveSortOrder(query.sort, {
      allowedFields: [
        'createdAt',
        'orderDate',
        'expectedDate',
        'poNo',
        'status',
        'paymentStatus',
        'supplierId',
      ],
      columnMap: {
        created_at: 'createdAt',
        order_date: 'orderDate',
        expected_date: 'expectedDate',
        due_date: 'expectedDate',
        po_no: 'poNo',
        payment_status: 'paymentStatus',
        supplier_id: 'supplierId',
      },
      defaultOrder: { orderDate: 'DESC', createdAt: 'DESC' },
    });

    let finalWhere: any = where;
    if (query.search) {
      finalWhere = [
        { ...where, poNo: ILike(`%${query.search}%`) },
        { ...where, supplierInvoiceNo: ILike(`%${query.search}%`) },
      ];
    }

    const [items, total] = await this.repository.findAndCount({
      where: finalWhere,
      relations: ['supplier', 'lines'],
      skip: (page - 1) * pageSize,
      take: pageSize,
      order,
    });
    return {
      items: items.map((x) => this.toCoreDocument(x as any)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const data = await this.repository.findOneByOrFail({
      id,
      isDeleted: false,
    });
    const lines = await this.lineRepository.find({
      where: { purchaseOrderId: id },
      order: { lineNo: 'ASC' },
    });
    const receipts = await this.getReceiptTimeline(id);
    return {
      message: 'Lấy thông tin thành công',
      data: this.toCoreDocument({ ...data, lines, receipts } as any),
    };
  }

  async getReceiptTimeline(id: string) {
    const receiptRepo = this.dataSource.getRepository(ErpGoodsReceipt);
    const receiptLineRepo = this.dataSource.getRepository(ErpGoodsReceiptLine);
    const receipts = await receiptRepo.find({
      where: { purchaseOrderId: id, isDeleted: false } as any,
      order: { receiptDate: 'ASC', createdAt: 'ASC' },
    });
    const visibleReceipts = receipts.filter(
      (receipt) => receipt.status !== 'DRAFT' && receipt.status !== 'CANCELLED',
    );
    const result = [] as any[];
    for (const receipt of visibleReceipts) {
      const lines = await receiptLineRepo.find({
        where: { goodsReceiptId: receipt.id },
        order: { lineNo: 'ASC' },
      });
      result.push({
        ...receipt,
        lines: lines.map((line) => ({
          ...line,
          qtyReceived:
            line.qtyReceived !== undefined && line.qtyReceived !== null
              ? String(line.qtyReceived)
              : '0',
          unitCost:
            line.unitCost !== undefined && line.unitCost !== null
              ? String(line.unitCost)
              : null,
          amount:
            line.amount !== undefined && line.amount !== null
              ? String(line.amount)
              : null,
        })),
      });
    }
    return result;
  }
  /**
   * Return all documents connected to this Purchase Order:
   * - Goods Receipts (erp_goods_receipts.purchase_order_id)
   * - Payment Vouchers (document_payment_links)
   * - Invoices (erp_invoices.purchase_order_id)
   */
  async getConnections(id: string) {
    const po = await this.repository.findOneByOrFail({ id, isDeleted: false });

    // Lấy tên nhà cung cấp (erp_purchase_orders không eager-load supplier)
    let supplierName: string | null = null;
    let supplierCode: string | null = null;
    if (po.supplierId) {
      const [row]: [{ name: string; code: string }?] =
        await this.dataSource.query(
          `SELECT name, code FROM public.erp_business_partners WHERE id = $1 LIMIT 1`,
          [po.supplierId],
        );
      supplierName = row?.name ?? null;
      supplierCode = row?.code ?? null;
    }

    // ─ GRs ─────────────────────────────────────────────────────
    const grRepo = this.dataSource.getRepository(ErpGoodsReceipt);
    const goodsReceipts = await grRepo.find({
      where: { purchaseOrderId: id, isDeleted: false } as any,
      order: { receiptDate: 'ASC' },
      select: ['id', 'receiptNo', 'receiptDate', 'status'],
    });

    // ─ Invoices ───────────────────────────────────────────
    const invoiceRepo = this.dataSource.getRepository(ErpInvoice);
    const invoices = await invoiceRepo.find({
      where: { purchaseOrderId: id, isDeleted: false } as any,
      select: [
        'id',
        'invoiceNo',
        'invoiceDate',
        'totalAmount',
        'status',
        'direction',
      ] as any,
    });

    return {
      message: 'Lấy dữ liệu kết nối thành công',
      data: {
        purchaseOrder: {
          id: po.id,
          poNo: po.poNo,
          orderDate: po.orderDate,
          status: po.status,
          paymentStatus: po.paymentStatus,
          supplierId: po.supplierId,
          supplierName: supplierName,
          supplierCode: supplierCode,
        },
        goodsReceipts,

        invoices,
      },
    };
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    const existing = await this.repository.findOneByOrFail({
      id,
      isDeleted: false,
    });
    const nextPoNo = dto.poNo?.trim();

    if (dto.status === 'CANCELLED' && existing.status !== 'CANCELLED') {
      await this.dependencyService.checkDependencies('purchase_orders', id);
    }
    if (nextPoNo && nextPoNo !== existing.poNo) {
      const duplicate = await this.repository.findOne({
        where: { poNo: nextPoNo },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Số chứng từ đã tồn tại');
      }
    }
    if (dto.status === 'DRAFT' && existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Phiếu mua hàng đã rời DRAFT thì không được chuyển về DRAFT',
      );
    }
    if (
      existing.status === 'RECEIVED' ||
      existing.status === 'FULLY_RECEIVED'
    ) {
      if (dto.status && dto.status !== existing.status) {
        throw new BadRequestException(
          'Không thể thay đổi trạng thái của phiếu mua hàng đã nhận',
        );
      }
    }

    const { lines, ...header } = dto as UpdatePurchaseOrderDto & {
      lines?: ErpPurchaseOrderLine[];
    };
    if ((header as any).poNo === '') {
      delete (header as any).poNo;
    } else if ((header as any).poNo) {
      (header as any).poNo = String((header as any).poNo).trim();
    }
    await this.repository.update(id, header as any);
    if (Array.isArray(lines)) {
      await this.dataSource.transaction(async (manager) => {
        const lineRepo = manager.getRepository(ErpPurchaseOrderLine);
        const existingLines = await lineRepo.find({
          where: { purchaseOrderId: id },
          order: { lineNo: 'ASC' },
        });

        let lineNo = 1;
        for (const [index, line] of (lines as any[]).entries()) {
          const existing = existingLines[index];
          if (existing) {
            existing.lineNo = lineNo++;
            existing.itemId = line.itemId ?? null;
            existing.itemCode = line.itemCode ?? null;
            existing.itemName = line.itemName ?? null;
            existing.description = line.description ?? null;
            existing.qtyOrdered = line.qtyOrdered;
            existing.unitPrice = line.unitPrice ?? null;
            existing.amount = line.amount ?? null;
            await lineRepo.save(existing);
          } else {
            await lineRepo.save(
              lineRepo.create({
                purchaseOrderId: id,
                lineNo: lineNo++,
                itemId: line.itemId ?? null,
                itemCode: line.itemCode ?? null,
                itemName: line.itemName ?? null,
                description: line.description ?? null,
                qtyOrdered: line.qtyOrdered,
                qtyReceived: '0',
                unitPrice: line.unitPrice ?? null,
                amount: line.amount ?? null,
              } as any),
            );
          }
        }

        // Remove any leftover lines that were deleted
        if (lines.length < existingLines.length) {
          for (let i = lines.length; i < existingLines.length; i++) {
            await lineRepo.remove(existingLines[i]);
          }
        }
      });
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.repository.findOneByOrFail({
      id,
      isDeleted: false,
    });
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể xóa phiếu nháp');
    }

    // Perform soft delete
    existing.isDeleted = true;
    await this.repository.save(existing);

    return {
      message: 'Xóa thành công',
      data: { id },
    };
  }

  async cancel(id: string) {
    const existing = await this.repository.findOneByOrFail({
      id,
      isDeleted: false,
    });
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Chứng từ đã bị hủy');
    }
    if (existing.status === 'DRAFT') {
      throw new BadRequestException('Không thể hủy phiếu nháp, vui lòng xóa');
    }
    if (
      existing.status === 'RECEIVED' ||
      existing.status === 'FULLY_RECEIVED'
    ) {
      throw new BadRequestException('Không thể hủy phiếu mua hàng đã nhận');
    }

    await this.dependencyService.checkDependencies('purchase_orders', id);

    existing.status = 'CANCELLED';
    await this.repository.save(existing);

    return {
      message: 'Hủy thành công',
      data: { id },
    };
  }

  async delete(id: string) {
    const record = await this.repository.findOne({ where: { id } });
    if (!record) throw new BadRequestException('Không tìm thấy đơn mua hàng');

    // Không cho phép xóa nếu đã có GR hoặc Hóa đơn
    await this.dependencyService.checkDependencies('purchase_orders', id);

    record.isDeleted = true;
    await this.repository.save(record);
    return { message: 'Xóa đơn mua hàng thành công' };
  }

  async findUnpaid() {
    return this.repository.find({
      where: {
        isDeleted: false,
        paymentStatus: Not('PAID'),
        status: Not('CANCELLED'),
      },
    });
  }

  async findRecurring(): Promise<any[]> {
    // Note: The new ErpPurchaseOrder entity does not have 'autoGenerateNext'
    // For now we return an empty array. PO recurrence should be handled in future sprints.
    return [];
  }

  private toCoreDocument(data: any) {
    const lines = Array.isArray(data?.lines)
      ? data.lines.map((line: any) => ({
          ...line,
          qtyOrdered:
            line.qtyOrdered !== undefined && line.qtyOrdered !== null
              ? String(line.qtyOrdered)
              : '0',
          qtyReceived:
            line.qtyReceived !== undefined && line.qtyReceived !== null
              ? String(line.qtyReceived)
              : '0',
          unitPrice:
            line.unitPrice !== undefined && line.unitPrice !== null
              ? String(line.unitPrice)
              : null,
          amount:
            line.amount !== undefined && line.amount !== null
              ? String(line.amount)
              : null,
        }))
      : undefined;

    return {
      ...data,
      supplierName: data.supplier?.name || data.supplierName,
      totalAmount: Array.isArray(lines)
        ? lines.reduce(
            (sum: number, line: any) => sum + Number(line.amount || 0),
            0,
          )
        : data.totalAmount,
      inventoryStatus:
        data.status === 'RECEIVED' || data.status === 'FULLY_RECEIVED'
          ? 'RECEIVED'
          : data.status === 'PARTIAL_RECEIVED'
            ? 'PARTIAL_RECEIVED'
            : 'NOT_RECEIVED',
      lines,
    };
  }

  async getLinkedInvoices(id: string) {
    const invoiceRepo = this.dataSource.getRepository(ErpInvoice);
    return invoiceRepo.find({
      where: { purchaseOrderId: id },
      order: { createdAt: 'DESC' },
    });
  }

  async linkInvoices(id: string, invoiceIds: string[]) {
    if (!invoiceIds || invoiceIds.length === 0)
      return { message: 'Thành công' };

    // Ensure PO exists
    const po = await this.repository.findOneBy({ id });
    if (!po) throw new BadRequestException('Không tìm thấy PO');

    await this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(ErpInvoice);
      await invoiceRepo.update({ id: In(invoiceIds) }, { purchaseOrderId: id });
    });

    return { message: 'Liên kết thành công' };
  }

  async unlinkInvoice(id: string, invoiceId: string) {
    await this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(ErpInvoice);
      await invoiceRepo.update(
        { id: invoiceId, purchaseOrderId: id },
        { purchaseOrderId: null },
      );
    });

    return { message: 'Hủy liên kết thành công' };
  }

  async exportPoExcel(id: string): Promise<Buffer> {
    const po = await this.repository.findOne({
      where: { id, isDeleted: false },
      relations: ['supplier'],
    });
    if (!po) {
      throw new NotFoundException('Không tìm thấy đơn mua hàng');
    }

    const companyProfile = await this.companyProfileService.getProfile();

    const lines = await this.lineRepository.find({
      where: { purchaseOrderId: id },
      order: { lineNo: 'ASC' },
    });

    const itemIds = lines
      .map((l) => l.itemId)
      .filter((itemId): itemId is string => Boolean(itemId));
    const itemUomMap = new Map<string, string>();
    const itemSkuMap = new Map<string, string>();
    if (itemIds.length > 0) {
      const items = await this.dataSource.getRepository(ErpInventoryItem).find({
        where: { id: In(itemIds) },
        relations: ['uom'],
      });
      for (const it of items) {
        if (it.uom) {
          itemUomMap.set(it.id, it.uom.name || it.uom.code);
        }
        if (it.sku) {
          itemSkuMap.set(it.id, it.sku);
        }
      }
    }

    const workbook = new ExcelJS.Workbook();
    const defaultFont = { name: 'Times New Roman', size: 11 };

    let orderDate = new Date();
    if (po.orderDate) {
      const parsed = new Date(po.orderDate);
      if (!isNaN(parsed.getTime())) orderDate = parsed;
    }

    const isDraft = po.status === 'DRAFT';

    if (!isDraft) {
      const sheet = workbook.addWorksheet('BangKeMuaHang', {
        pageSetup: { paperSize: 9, orientation: 'portrait' },
      });

      sheet.columns = [
        { key: 'stt', width: 6 },
        { key: 'name', width: 42 },
        { key: 'address', width: 38 },
        { key: 'uom', width: 12 },
        { key: 'qty', width: 12 },
        { key: 'price', width: 16 },
        { key: 'amount', width: 18 },
      ];

      if (companyProfile?.logo) {
        try {
          let base64Data = companyProfile.logo;
          let extension: 'png' | 'jpeg' = 'png';
          if (base64Data.startsWith('data:image/')) {
            const parts = base64Data.split(';base64,');
            const match = parts[0].match(/data:image\/(\w+)/);
            if (match && (match[1] === 'jpeg' || match[1] === 'jpg')) {
              extension = 'jpeg';
            }
            base64Data = parts[1];
          }
          if (base64Data && base64Data.length > 20) {
            const imageId = workbook.addImage({
              base64: base64Data,
              extension,
            });
            sheet.addImage(imageId, {
              tl: { col: 0.1, row: 0.1 },
              ext: { width: 100, height: 40 },
            });
          }
        } catch {
          // ignore logo errors
        }
      }

      // Header top
      const r1 = sheet.addRow([
        `Đơn vị: ${companyProfile?.company_name || '....................................'}`,
        '',
        '',
        '',
        'Mẫu số 06 - VT',
        '',
        '',
      ]);
      sheet.mergeCells(`A${r1.number}:D${r1.number}`);
      sheet.mergeCells(`E${r1.number}:G${r1.number}`);
      r1.getCell('A').font = { ...defaultFont, bold: true };
      r1.getCell('A').alignment = {
        horizontal: 'left',
        vertical: 'middle',
        wrapText: true,
      };
      r1.getCell('E').font = { ...defaultFont, bold: true };
      r1.getCell('E').alignment = { horizontal: 'center', vertical: 'middle' };
      r1.height = 30;

      const r2 = sheet.addRow([
        `Địa chỉ: ${companyProfile?.address || '....................................'}`,
        '',
        '',
        '',
        '(Ban hành theo Thông tư số 133/2016/TT-BTC',
        '',
        '',
      ]);
      sheet.mergeCells(`A${r2.number}:D${r2.number}`);
      sheet.mergeCells(`E${r2.number}:G${r2.number}`);
      r2.getCell('A').font = defaultFont;
      r2.getCell('A').alignment = {
        horizontal: 'left',
        vertical: 'middle',
        wrapText: true,
      };
      r2.getCell('E').font = { ...defaultFont, italic: true, size: 9 };
      r2.getCell('E').alignment = { horizontal: 'center', vertical: 'middle' };
      r2.height = 30;

      const r3 = sheet.addRow([
        'Bộ phận: ....................................',
        '',
        '',
        '',
        'ngày 26/8/2016 của Bộ Tài chính)',
        '',
        '',
      ]);
      sheet.mergeCells(`A${r3.number}:D${r3.number}`);
      sheet.mergeCells(`E${r3.number}:G${r3.number}`);
      r3.getCell('A').font = defaultFont;
      r3.getCell('A').alignment = { horizontal: 'left', vertical: 'middle' };
      r3.getCell('E').font = { ...defaultFont, italic: true, size: 9 };
      r3.getCell('E').alignment = { horizontal: 'center', vertical: 'middle' };
      r3.height = 24;

      const sp1 = sheet.addRow([]);
      sp1.height = 14;

      const titleRow = sheet.addRow([
        'BẢNG KÊ MUA HÀNG',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
      sheet.mergeCells(`A${titleRow.number}:G${titleRow.number}`);
      titleRow.getCell('A').font = { ...defaultFont, bold: true, size: 16 };
      titleRow.getCell('A').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      titleRow.height = 36;

      const dateRow = sheet.addRow([
        `Ngày ${format(orderDate, 'dd')} tháng ${format(orderDate, 'MM')} năm ${format(orderDate, 'yyyy')}`,
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
      sheet.mergeCells(`A${dateRow.number}:G${dateRow.number}`);
      dateRow.getCell('A').font = { ...defaultFont, italic: true, size: 11 };
      dateRow.getCell('A').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      dateRow.height = 24;

      const metaRow1 = sheet.addRow([
        '',
        '',
        '',
        '',
        'Quyển số: .................',
        '',
        '',
      ]);
      sheet.mergeCells(`E${metaRow1.number}:G${metaRow1.number}`);
      metaRow1.getCell('E').font = defaultFont;
      metaRow1.height = 24;

      const metaRow2 = sheet.addRow([
        '',
        '',
        '',
        '',
        `Số: ${po.poNo || ''}`,
        '',
        '',
      ]);
      sheet.mergeCells(`E${metaRow2.number}:G${metaRow2.number}`);
      metaRow2.getCell('E').font = { ...defaultFont, bold: true };
      metaRow2.height = 26;

      const metaRow3 = sheet.addRow([
        '',
        '',
        '',
        '',
        'Nợ: ....................',
        '',
        '',
      ]);
      sheet.mergeCells(`E${metaRow3.number}:G${metaRow3.number}`);
      metaRow3.getCell('E').font = defaultFont;
      metaRow3.height = 24;

      const metaRow4 = sheet.addRow([
        `- Họ và tên người mua: ${po.createdBy || '...................................................'}`,
        '',
        '',
        '',
        'Có: ....................',
        '',
        '',
      ]);
      sheet.mergeCells(`A${metaRow4.number}:D${metaRow4.number}`);
      sheet.mergeCells(`E${metaRow4.number}:G${metaRow4.number}`);
      metaRow4.getCell('A').font = defaultFont;
      metaRow4.getCell('E').font = defaultFont;
      metaRow4.height = 28;

      const metaRow5 = sheet.addRow([
        '- Bộ phận (phòng, ban): ...................................................',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
      sheet.mergeCells(`A${metaRow5.number}:G${metaRow5.number}`);
      metaRow5.getCell('A').font = defaultFont;
      metaRow5.height = 26;

      const sp2 = sheet.addRow([]);
      sp2.height = 14;

      const th1 = sheet.addRow([
        'STT',
        'Tên, quy cách, phẩm chất hàng hóa\n(vật tư, công cụ...)',
        'Địa chỉ\nmua hàng',
        'Đơn vị\ntính',
        'Số\nlượng',
        'Đơn\ngiá',
        'Thành\ntiền',
      ]);
      th1.height = 56;

      const th2 = sheet.addRow(['A', 'B', 'C', 'D', '1', '2', '3']);
      th2.height = 24;

      [th1, th2].forEach((row) => {
        row.eachCell((cell) => {
          cell.font = { ...defaultFont, bold: row === th1 };
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true,
          };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });

      let totalQty = 0;
      let totalAmount = 0;
      lines.forEach((line, index) => {
        const qty = Number(line.qtyOrdered) || 0;
        const price = Number(line.unitPrice) || 0;
        const lineAmount = Number(line.amount) || qty * price;
        totalQty += qty;
        totalAmount += lineAmount;

        const uom = (line.itemId && itemUomMap.get(line.itemId)) || '';
        const sku =
          line.itemCode || (line.itemId && itemSkuMap.get(line.itemId)) || '';
        const rawName = line.itemName || line.description || '';
        const displayName = sku ? `${rawName} - ${sku}` : rawName;
        const supplierName = po.supplier?.name || '';

        const dataRow = sheet.addRow([
          index + 1,
          displayName,
          supplierName,
          uom,
          qty,
          price,
          lineAmount,
        ]);

        // Dynamically compute row height based on content wrapping
        const nameLines = Math.ceil(displayName.length / 36);
        const suppLines = Math.ceil(supplierName.length / 32);
        const maxLines = Math.max(nameLines, suppLines, 1);
        dataRow.height = Math.max(36, maxLines * 26);

        dataRow.eachCell((cell, colNum) => {
          cell.font = defaultFont;
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
          if (colNum === 1 || colNum === 4) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNum === 5) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.numFmt = '#,##0.00';
          } else if (colNum >= 6) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.numFmt = '#,##0';
          } else {
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'left',
              wrapText: true,
            };
          }
        });
      });

      const summaryRow = sheet.addRow([
        'Cộng',
        '',
        '',
        '',
        totalQty,
        'x',
        totalAmount,
      ]);
      summaryRow.height = 28;
      sheet.mergeCells(`A${summaryRow.number}:D${summaryRow.number}`);
      summaryRow.eachCell((cell, colNum) => {
        cell.font = { ...defaultFont, bold: true };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        if (colNum === 1 || colNum === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNum === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0.00';
        } else if (colNum === 7) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0';
        }
      });

      const sp3 = sheet.addRow([]);
      sp3.height = 14;

      const amountTextRow = sheet.addRow([
        `- Tổng số tiền (Viết bằng chữ): ${readVietnameseCurrency(totalAmount)}`,
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
      amountTextRow.height = 28;
      sheet.mergeCells(`A${amountTextRow.number}:G${amountTextRow.number}`);
      amountTextRow.getCell('A').font = { ...defaultFont, italic: true };

      const noteRow = sheet.addRow([
        `* Ghi chú: ${po.remarks || '..................................................................'}`,
      ]);
      noteRow.height = 28;
      sheet.mergeCells(`A${noteRow.number}:G${noteRow.number}`);
      noteRow.getCell('A').font = { ...defaultFont, italic: true };

      const sp4 = sheet.addRow([]);
      sp4.height = 16;

      const signRow1 = sheet.addRow([
        'Người mua',
        '',
        'Kế toán trưởng',
        '',
        'Người duyệt mua',
        '',
        '',
      ]);
      sheet.mergeCells(`A${signRow1.number}:B${signRow1.number}`);
      sheet.mergeCells(`C${signRow1.number}:D${signRow1.number}`);
      sheet.mergeCells(`E${signRow1.number}:G${signRow1.number}`);
      signRow1.eachCell((cell) => {
        cell.font = { ...defaultFont, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      signRow1.height = 28;

      const signRow2 = sheet.addRow([
        '(Ký, họ tên)',
        '',
        '(Ký, họ tên)',
        '',
        '(Ký, họ tên)',
        '',
        '',
      ]);
      sheet.mergeCells(`A${signRow2.number}:B${signRow2.number}`);
      sheet.mergeCells(`C${signRow2.number}:D${signRow2.number}`);
      sheet.mergeCells(`E${signRow2.number}:G${signRow2.number}`);
      signRow2.eachCell((cell) => {
        cell.font = { ...defaultFont, italic: true, size: 10 };
        cell.alignment = { vertical: 'top', horizontal: 'center' };
      });
      sheet.getRow(signRow2.number).height = 65;
    } else {
      const sheet = workbook.addWorksheet('PhieuDeXuatMuaHang', {
        pageSetup: { paperSize: 9, orientation: 'portrait' },
      });

      sheet.columns = [
        { key: 'stt', width: 6 },
        { key: 'name', width: 48 },
        { key: 'qty', width: 14 },
        { key: 'price', width: 18 },
        { key: 'amount', width: 20 },
      ];

      if (companyProfile?.logo) {
        try {
          let base64Data = companyProfile.logo;
          let extension: 'png' | 'jpeg' = 'png';
          if (base64Data.startsWith('data:image/')) {
            const parts = base64Data.split(';base64,');
            const match = parts[0].match(/data:image\/(\w+)/);
            if (match && (match[1] === 'jpeg' || match[1] === 'jpg')) {
              extension = 'jpeg';
            }
            base64Data = parts[1];
          }
          if (base64Data && base64Data.length > 20) {
            const imageId = workbook.addImage({
              base64: base64Data,
              extension,
            });
            sheet.addImage(imageId, {
              tl: { col: 0.1, row: 0.1 },
              ext: { width: 100, height: 40 },
            });
          }
        } catch {
          // ignore logo errors
        }
      }

      const r1 = sheet.addRow([
        `Đơn vị: ${companyProfile?.company_name || '....................................'}`,
        '',
        'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
        '',
        '',
      ]);
      sheet.mergeCells(`A${r1.number}:B${r1.number}`);
      sheet.mergeCells(`C${r1.number}:E${r1.number}`);
      r1.getCell('A').font = { ...defaultFont, bold: true };
      r1.getCell('A').alignment = {
        horizontal: 'left',
        vertical: 'middle',
        wrapText: true,
      };
      r1.getCell('C').font = { ...defaultFont, bold: true, size: 12 };
      r1.getCell('C').alignment = { horizontal: 'center', vertical: 'middle' };
      r1.height = 28;

      const r2 = sheet.addRow([
        `Địa chỉ: ${companyProfile?.address || '....................................'}`,
        '',
        'Độc lập – Tự do – Hạnh phúc',
        '',
        '',
      ]);
      sheet.mergeCells(`A${r2.number}:B${r2.number}`);
      sheet.mergeCells(`C${r2.number}:E${r2.number}`);
      r2.getCell('A').font = defaultFont;
      r2.getCell('A').alignment = {
        horizontal: 'left',
        vertical: 'middle',
        wrapText: true,
      };
      r2.getCell('C').font = { ...defaultFont, bold: true, size: 11 };
      r2.getCell('C').alignment = { horizontal: 'center', vertical: 'middle' };
      r2.height = 28;

      const r3 = sheet.addRow(['', '', '-----------------', '', '']);
      sheet.mergeCells(`C${r3.number}:E${r3.number}`);
      r3.getCell('C').font = defaultFont;
      r3.getCell('C').alignment = { horizontal: 'center', vertical: 'middle' };
      r3.height = 18;

      const r4 = sheet.addRow([
        '',
        '',
        `........., ngày ${format(orderDate, 'dd')} tháng ${format(orderDate, 'MM')} năm ${format(orderDate, 'yyyy')}`,
        '',
        '',
      ]);
      sheet.mergeCells(`C${r4.number}:E${r4.number}`);
      r4.getCell('C').font = { ...defaultFont, italic: true };
      r4.getCell('C').alignment = { horizontal: 'center', vertical: 'middle' };
      r4.height = 24;

      const sp1 = sheet.addRow([]);
      sp1.height = 14;

      const titleRow = sheet.addRow(['PHIẾU ĐỀ XUẤT MUA HÀNG', '', '', '', '']);
      sheet.mergeCells(`A${titleRow.number}:E${titleRow.number}`);
      titleRow.getCell('A').font = { ...defaultFont, bold: true, size: 16 };
      titleRow.getCell('A').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      titleRow.height = 36;

      const sp2 = sheet.addRow([]);
      sp2.height = 14;

      const m1 = sheet.addRow(['Kính gửi: Ban Giám Đốc', '', '', '', '']);
      sheet.mergeCells(`A${m1.number}:E${m1.number}`);
      m1.getCell('A').font = defaultFont;
      m1.height = 24;

      const m2 = sheet.addRow([
        'Họ và tên người xuất: .................................................................................................',
        '',
        '',
        '',
        '',
      ]);
      sheet.mergeCells(`A${m2.number}:E${m2.number}`);
      m2.getCell('A').font = defaultFont;
      m2.height = 24;

      const m3 = sheet.addRow([
        'Chức danh: ...................................................',
        '',
        'Bộ phận: ...................................................',
        '',
        '',
      ]);
      sheet.mergeCells(`A${m3.number}:B${m3.number}`);
      sheet.mergeCells(`C${m3.number}:E${m3.number}`);
      m3.getCell('A').font = defaultFont;
      m3.getCell('C').font = defaultFont;
      m3.height = 24;

      const m4 = sheet.addRow([
        `Nội dung đề xuất: ${po.remarks || 'Mua sắm vật tư theo đơn hàng ' + po.poNo}`,
        '',
        '',
        '',
        '',
      ]);
      sheet.mergeCells(`A${m4.number}:E${m4.number}`);
      m4.getCell('A').font = defaultFont;
      m4.height = 28;

      const expectedDateStr = po.expectedDate
        ? format(new Date(po.expectedDate), 'dd/MM/yyyy')
        : '...................................................';
      const m5 = sheet.addRow([
        `Thời gian cần thực hiện: ${expectedDateStr}`,
        '',
        '',
        '',
        '',
      ]);
      sheet.mergeCells(`A${m5.number}:E${m5.number}`);
      m5.getCell('A').font = defaultFont;
      m5.height = 24;

      const sp3 = sheet.addRow([]);
      sp3.height = 14;

      const th = sheet.addRow([
        'STT',
        'TÊN HÀNG HOÁ / MÃ LINH KIỆN',
        'SỐ LƯỢNG',
        'GIÁ ĐƠN',
        'THÀNH TIỀN',
      ]);
      th.height = 36;
      th.eachCell((cell) => {
        cell.font = { ...defaultFont, bold: true };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      let totalQty = 0;
      let totalAmount = 0;
      lines.forEach((line, index) => {
        const qty = Number(line.qtyOrdered) || 0;
        const price = Number(line.unitPrice) || 0;
        const lineAmount = Number(line.amount) || qty * price;
        totalQty += qty;
        totalAmount += lineAmount;

        const sku =
          line.itemCode || (line.itemId && itemSkuMap.get(line.itemId)) || '';
        const rawName = line.itemName || line.description || '';
        const displayName = sku ? `${rawName} - ${sku}` : rawName;

        const dataRow = sheet.addRow([
          index + 1,
          displayName,
          qty,
          price,
          lineAmount,
        ]);

        const nameLines = Math.ceil(displayName.length / 40);
        dataRow.height = Math.max(34, nameLines * 26);

        dataRow.eachCell((cell, colNum) => {
          cell.font = defaultFont;
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
          if (colNum === 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNum === 3) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.numFmt = '#,##0.00';
          } else if (colNum >= 4) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.numFmt = '#,##0';
          } else {
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'left',
              wrapText: true,
            };
          }
        });
      });

      const summaryRow = sheet.addRow([
        'Tổng cộng',
        '',
        totalQty,
        '',
        totalAmount,
      ]);
      summaryRow.height = 28;
      sheet.mergeCells(`A${summaryRow.number}:B${summaryRow.number}`);
      summaryRow.eachCell((cell, colNum) => {
        cell.font = { ...defaultFont, bold: true };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        if (colNum === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNum === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0.00';
        } else if (colNum === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0';
        }
      });

      const sp4 = sheet.addRow([]);
      sp4.height = 14;

      const amountTextRow = sheet.addRow([
        `- Tổng số tiền (Viết bằng chữ): ${readVietnameseCurrency(totalAmount)}`,
        '',
        '',
        '',
        '',
      ]);
      amountTextRow.height = 28;
      sheet.mergeCells(`A${amountTextRow.number}:E${amountTextRow.number}`);
      amountTextRow.getCell('A').font = { ...defaultFont, italic: true };

      const sp5 = sheet.addRow([]);
      sp5.height = 16;

      const signRow1 = sheet.addRow([
        'PHÊ DUYỆT GIÁM ĐỐC',
        '',
        'KẾ TOÁN TRƯỞNG',
        'NGƯỜI ĐỀ NGHỊ',
        '',
      ]);
      sheet.mergeCells(`A${signRow1.number}:B${signRow1.number}`);
      sheet.mergeCells(`D${signRow1.number}:E${signRow1.number}`);
      signRow1.eachCell((cell) => {
        cell.font = { ...defaultFont, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      signRow1.height = 28;

      const signRow2 = sheet.addRow([
        '(Ký và ghi rõ họ tên)',
        '',
        '(Ký và ghi rõ họ tên)',
        '(Ký và ghi rõ họ tên)',
        '',
      ]);
      sheet.mergeCells(`A${signRow2.number}:B${signRow2.number}`);
      sheet.mergeCells(`D${signRow2.number}:E${signRow2.number}`);
      signRow2.eachCell((cell) => {
        cell.font = { ...defaultFont, italic: true, size: 10 };
        cell.alignment = { vertical: 'top', horizontal: 'center' };
      });
      sheet.getRow(signRow2.number).height = 65;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

function readVietnameseCurrency(num: number): string {
  if (!num || num === 0) return 'Không đồng';
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const digits = [
    'không',
    'một',
    'hai',
    'ba',
    'bốn',
    'năm',
    'sáu',
    'bảy',
    'tám',
    'chín',
  ];

  function readThreeDigits(n: number, isFirst: boolean): string {
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    let res = '';
    if (h > 0 || !isFirst) {
      res += digits[h] + ' trăm ';
    }
    if (t > 1) {
      res += digits[t] + ' mươi ';
      if (u === 1) res += 'mốt';
      else if (u === 5) res += 'lăm';
      else if (u > 0) res += digits[u];
    } else if (t === 1) {
      res += 'mười ';
      if (u === 5) res += 'lăm';
      else if (u > 0) res += digits[u];
    } else {
      if ((h > 0 || !isFirst) && u > 0) res += 'lẻ ';
      if (u > 0) res += digits[u];
    }
    return res.trim();
  }

  let strNum = Math.round(Math.abs(num)).toString();
  const groups: number[] = [];
  while (strNum.length > 0) {
    groups.unshift(parseInt(strNum.slice(-3), 10));
    strNum = strNum.slice(0, -3);
  }

  const words: string[] = [];
  for (let i = 0; i < groups.length; i++) {
    const grp = groups[i];
    if (grp > 0) {
      const isFirst = i === 0;
      const grpWords = readThreeDigits(grp, isFirst);
      const unit = units[groups.length - 1 - i];
      words.push(grpWords + (unit ? ' ' + unit : ''));
    }
  }

  const result = words.join(' ').replace(/\s+/g, ' ').trim();
  return result
    ? result.charAt(0).toUpperCase() + result.slice(1) + ' đồng'
    : 'Không đồng';
}
