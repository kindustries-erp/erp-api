import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ErpPurchaseOrder } from './entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from './entities/erp_purchase_order_line.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

@Injectable()
export class PurchaseOrdersCoreService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpPurchaseOrder)
    private readonly repository: Repository<ErpPurchaseOrder>,
    @InjectRepository(ErpPurchaseOrderLine)
    private readonly lineRepository: Repository<ErpPurchaseOrderLine>,
  ) {}

  async create(dto: CreatePurchaseOrderDto | any) {
    const normalized = this.normalizePayload(dto);
    const { lines = [], ...header } = normalized;

    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(ErpPurchaseOrder);
      const lineRepo = manager.getRepository(ErpPurchaseOrderLine);
      const headerPayload: DeepPartial<ErpPurchaseOrder> = {
        ...header,
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
        data: this.toLegacyCompatibleDocument({ ...data, lines: savedLines } as any),
      };
    });
  }

  async findAll(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [items, total] = await this.repository.findAndCount({
      where: query.search
        ? ([{ poNo: ILike(`%${query.search}%`) }] as any)
        : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });
    return {
      items: items.map((x) => this.toLegacyCompatibleDocument(x as any)),
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
    return {
      message: 'Lấy thông tin thành công',
      data: this.toLegacyCompatibleDocument({ ...data, lines } as any),
    };
  }

  async update(id: string, dto: UpdatePurchaseOrderDto | any) {
    const normalized = this.normalizePayload(dto);
    const { lines, ...header } = normalized as any;
    await this.repository.update(id, header);
    if (Array.isArray(lines)) {
      await this.dataSource.transaction(async (manager) => {
        const lineRepo = manager.getRepository(ErpPurchaseOrderLine);
        await lineRepo.delete({ purchaseOrderId: id });
        let lineNo = 1;
        for (const line of lines) {
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

  private normalizePayload(dto: any) {
    const lines = Array.isArray(dto?.lines)
      ? dto.lines.map((line: any) => ({
          itemId:
            line.itemId ?? line.item_id ?? line.inventory_item_id ?? null,
          description:
            line.description ?? line.item_name ?? line.itemName ?? line.item_code ?? null,
          qtyOrdered: String(line.qtyOrdered ?? line.qty ?? '0'),
          qtyReceived:
            line.qtyReceived !== undefined ? String(line.qtyReceived) : undefined,
          unitPrice:
            line.unitPrice !== undefined || line.unit_price !== undefined
              ? String(line.unitPrice ?? line.unit_price)
              : undefined,
          amount:
            line.amount !== undefined ? String(line.amount) : undefined,
        }))
      : [];

    return {
      poNo: dto?.poNo ?? dto?.purchase_no ?? dto?.purchaseNo,
      supplierId: dto?.supplierId ?? dto?.supplier_id,
      orderDate: dto?.orderDate ?? dto?.document_date,
      expectedDate:
        dto?.expectedDate ?? dto?.expected_receipt_date ?? dto?.due_date,
      status: dto?.status,
      remarks: dto?.remarks ?? dto?.notes,
      lines,
    };
  }

  private toLegacyCompatibleDocument(data: any) {
    const lines = Array.isArray(data?.lines)
      ? data.lines.map((line: any) => ({
          ...line,
          line_no: line.lineNo,
          inventory_item_id: line.itemId,
          item_id: line.itemId,
          item_name: line.description,
          qty: Number(line.qtyOrdered ?? 0),
          qty_ordered: Number(line.qtyOrdered ?? 0),
          qty_received: Number(line.qtyReceived ?? 0),
          unit_price:
            line.unitPrice !== null && line.unitPrice !== undefined
              ? Number(line.unitPrice)
              : 0,
        }))
      : undefined;

    const totalAmount = Array.isArray(lines)
      ? lines.reduce(
          (sum: number, line: any) =>
            sum + Number(line.amount ?? Number(line.qtyOrdered ?? 0) * Number(line.unitPrice ?? 0)),
          0,
        )
      : 0;

    return {
      ...data,
      purchase_no: data.poNo,
      supplier_id: data.supplierId,
      document_date: data.orderDate,
      expected_receipt_date: data.expectedDate,
      due_date: data.expectedDate,
      invoice_status: 'NO_INVOICE',
      payment_status: 'UNPAID',
      accounting_status: 'UNPOSTED',
      inventory_status:
        data.status === 'RECEIVED'
          ? 'FULLY_RECEIVED'
          : data.status === 'PARTIAL_RECEIVED'
            ? 'PARTIAL'
            : 'NOT_RECEIVED',
      total_amount: totalAmount,
      settled_amount: 0,
      open_amount: totalAmount,
      recurrence_type: 'ONE_TIME',
      auto_generate_next: false,
      notes: data.remarks ?? null,
      supplier_name_snapshot: data.supplierName ?? null,
      document_type: 'purchase_orders',
      lines,
    };
  }
}
