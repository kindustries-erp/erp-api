import { BadRequestException, Injectable } from '@nestjs/common';
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

  async create(dto: CreatePurchaseOrderDto) {
    const { lines = [], ...header } = dto;

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
        data: this.toCoreDocument({ ...data, lines: savedLines } as any),
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
      relations: ['supplier', 'lines'],
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
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
    return {
      message: 'Lấy thông tin thành công',
      data: this.toCoreDocument({ ...data, lines } as any),
    };
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    const existing = await this.repository.findOneByOrFail({ id });
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
