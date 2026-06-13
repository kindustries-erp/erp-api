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
} from 'typeorm';
import { OperationalQueryDto } from '../operational-documents/dto/operational-document.dto';
import { ErpPurchaseOrder } from './entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from './entities/erp_purchase_order_line.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ErpGoodsReceipt } from '../goods-receipts-core/entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from '../goods-receipts-core/entities/erp_goods_receipt_line.entity';
import { resolveSortOrder } from '../common/utils/sort.util';

@Injectable()
export class PurchaseOrdersCoreService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpPurchaseOrder)
    private readonly repository: Repository<ErpPurchaseOrder>,
    @InjectRepository(ErpPurchaseOrderLine)
    private readonly lineRepository: Repository<ErpPurchaseOrderLine>,
  ) {}

  private async generateMonthlyPoNo(manager: any, orderDate?: string) {
    const baseDate = orderDate ? new Date(orderDate) : new Date();
    const year = baseDate.getUTCFullYear();
    const month = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    const prefix = `PO-${year}${month}`;
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

  async findAll(query: OperationalQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: any = {};
    if (query.search) {
      where.poNo = ILike(`%${query.search}%`);
    }
    if (query.status) {
      where.status = query.status;
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
      defaultOrder: { createdAt: 'DESC' },
    });

    const [items, total] = await this.repository.findAndCount({
      where,
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
    const data = await this.repository.findOneByOrFail({ id });
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
      where: { purchaseOrderId: id } as any,
      order: { receiptDate: 'ASC', createdAt: 'ASC' },
    });
    const visibleReceipts = receipts.filter(
      (receipt) => receipt.status !== 'DRAFT',
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
  async update(id: string, dto: UpdatePurchaseOrderDto) {
    const existing = await this.repository.findOneByOrFail({ id });
    const nextPoNo = dto.poNo?.trim();
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
