import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
              qb.andWhere(`po.supplierNameSnapshot IN (:${paramName})`, {
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
        field = 'po.supplierNameSnapshot';
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
              where.supplierNameSnapshot = ILike(`%${strVal}%`);
            else if (key === 'status') where.status = ILike(`%${strVal}%`);
            else if (key === 'paymentStatus')
              where.paymentStatus = ILike(`%${strVal}%`);
            else if (key === 'title') where.title = ILike(`%${strVal}%`);
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
              where.supplierNameSnapshot = In(values);
            else if (key === 'title') where.title = In(values);
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

    // ─ Payment links ───────────────────────────────────────
    // TODO: Restore when document_payment_links table is confirmed to exist in
    //       all environments. The query below joins document_payment_links with
    //       payment_vouchers to get settled vouchers linked to this PO.
    //
    // const paymentLinks = await this.dataSource.query(
    //   `SELECT
    //      dpl.id               AS "linkId",
    //      pv.id                AS "voucherId",
    //      pv.voucher_no        AS "voucherNo",
    //      dpl.applied_amount   AS "appliedAmount",
    //      dpl.applied_date     AS "appliedDate",
    //      pv.status            AS "voucherStatus"
    //    FROM public.document_payment_links dpl
    //    JOIN public.payment_vouchers pv ON pv.id = dpl.payment_voucher_id
    //    WHERE dpl.document_type = 'purchase_orders'
    //      AND dpl.document_id  = $1`,
    //   [id],
    // );
    const paymentLinks: {
      linkId: string;
      voucherId: string;
      voucherNo: string;
      appliedAmount: number;
      appliedDate: string | null;
      voucherStatus: string;
    }[] = [];

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
        paymentLinks,
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
        await lineRepo.delete({ purchaseOrderId: id });
        let lineNo = 1;
        for (const line of lines as any[]) {
          await lineRepo.save(
            lineRepo.create({
              purchaseOrderId: id,
              lineNo: lineNo++,
              itemId: line.itemId ?? null,
              itemCode: line.itemCode ?? null,
              itemName: line.itemName ?? null,
              description: line.description ?? null,
              qtyOrdered: line.qtyOrdered,
              qtyReceived: line.qtyReceived ?? '0',
              unitPrice: line.unitPrice ?? null,
              amount: line.amount ?? null,
            } as any),
          );
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
}
