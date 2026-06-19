import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpSalesOrder } from './entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from './entities/erp_sales_order_line.entity';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { ReserveSalesOrderDto } from './dto/reserve-sales-order.dto';
import { UnreserveSalesOrderDto } from './dto/unreserve-sales-order.dto';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { DocumentDependenciesCoreService } from '../document-dependencies-core/document-dependencies-core.service';

@Injectable()
export class SalesOrdersCoreService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpSalesOrder)
    private readonly repository: Repository<ErpSalesOrder>,
    @InjectRepository(ErpSalesOrderLine)
    private readonly lineRepository: Repository<ErpSalesOrderLine>,
    private readonly dependencyService: DocumentDependenciesCoreService,
  ) {}

  private async getSalesOrderOrThrow(
    repository: Repository<ErpSalesOrder>,
    id: string,
  ) {
    const salesOrder = await repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!salesOrder) {
      throw new NotFoundException('Không tìm thấy đơn bán hàng');
    }
    return salesOrder;
  }

  async create(dto: CreateSalesOrderDto) {
    const { lines = [], ...header } = dto;
    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(ErpSalesOrder);
      const lineRepo = manager.getRepository(ErpSalesOrderLine);
      const headerPayload: DeepPartial<ErpSalesOrder> = {
        status: header.status ?? 'DRAFT',
        ...header,
      };
      const data = await headerRepo.save(headerPayload);
      const savedLines: ErpSalesOrderLine[] = [];
      let lineNo = 1;
      for (const line of lines) {
        const linePayload: DeepPartial<ErpSalesOrderLine> = {
          salesOrderId: data.id,
          lineNo: lineNo++,
          itemId: line.itemId ?? null,
          qtyOrdered: line.qtyOrdered,
          qtyReserved: '0',
          qtyDelivered: '0',
          unitPrice: line.unitPrice ?? null,
          amount: line.amount ?? null,
        };
        const saved = await lineRepo.save(linePayload);
        savedLines.push(saved);
      }
      return {
        message: 'Tạo thành công',
        data: { ...data, lines: savedLines },
      };
    });
  }

  async findAll(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const order = resolveSortOrder(query.sort, {
      defaultOrder: { createdAt: 'DESC' },
    });

    const [items, total] = await this.repository.findAndCount({
      where: [
        {
          ...(query.search ? { soNo: ILike(`%${query.search}%`) } : {}),
          isDeleted: false,
        },
      ] as any,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order,
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const data = await this.getSalesOrderOrThrow(this.repository, id);
    const lines = await this.lineRepository.find({
      where: { salesOrderId: id },
      order: { lineNo: 'ASC' },
    });
    return { message: 'Lấy thông tin thành công', data: { ...data, lines } };
  }

  async update(id: string, dto: UpdateSalesOrderDto) {
    const { lines, ...header } = dto as any;

    if (header.status === 'CANCELLED') {
      const existing = await this.repository.findOneBy({ id });
      if (existing && existing.status !== 'CANCELLED') {
        await this.dependencyService.checkDependencies(
          'sales_service_orders',
          id,
        );
      }
    }

    await this.repository.update(id, header);
    if (Array.isArray(lines)) {
      await this.dataSource.transaction(async (manager) => {
        const lineRepo = manager.getRepository(ErpSalesOrderLine);
        await lineRepo.delete({ salesOrderId: id });
        let lineNo = 1;
        for (const line of lines) {
          const linePayload: DeepPartial<ErpSalesOrderLine> = {
            salesOrderId: id,
            lineNo: lineNo++,
            itemId: line.itemId ?? null,
            qtyOrdered: line.qtyOrdered,
            qtyReserved: line.qtyReserved ?? '0',
            qtyDelivered: line.qtyDelivered ?? '0',
            unitPrice: line.unitPrice ?? null,
            amount: line.amount ?? null,
          };
          await lineRepo.save(linePayload);
        }
      });
    }
    return this.findOne(id);
  }

  async reserve(id: string, dto: ReserveSalesOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const soRepo = manager.getRepository(ErpSalesOrder);
      const soLineRepo = manager.getRepository(ErpSalesOrderLine);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);

      const so = await this.getSalesOrderOrThrow(soRepo, id);
      const lines = await soLineRepo.find({
        where: { salesOrderId: id },
        order: { lineNo: 'ASC' },
      });
      if (lines.length === 0) {
        throw new BadRequestException('Sales order chưa có dòng hàng');
      }

      for (const line of lines) {
        const qtyOrdered = Number(line.qtyOrdered || 0);
        const qtyDelivered = Number(line.qtyDelivered || 0);
        const qtyReserved = Number(line.qtyReserved || 0);
        const qtyNeedReserve = qtyOrdered - qtyDelivered - qtyReserved;
        if (qtyNeedReserve <= 0) {
          continue;
        }

        const balance = await balanceRepo.findOne({
          where: {
            itemId: line.itemId ?? undefined,
            warehouseCode: dto.warehouseCode ?? undefined,
          } as any,
        });
        if (!balance) {
          continue;
        }
        const onHand = Number(balance.qtyOnHand || 0);
        const reserved = Number(balance.qtyReserved || 0);
        const available = onHand - reserved;
        const qtyToReserve = Math.min(available, qtyNeedReserve);
        if (qtyToReserve <= 0) {
          continue;
        }

        balance.qtyReserved = (reserved + qtyToReserve).toFixed(3);
        await balanceRepo.save(balance);

        line.qtyReserved = (qtyReserved + qtyToReserve).toFixed(3);
        await soLineRepo.save(line);
      }

      const refreshedLines = await soLineRepo.find({
        where: { salesOrderId: id },
      });
      const allReserved =
        refreshedLines.length > 0 &&
        refreshedLines.every(
          (line) =>
            Number(line.qtyReserved || 0) + Number(line.qtyDelivered || 0) >=
            Number(line.qtyOrdered || 0),
        );
      const anyReserved = refreshedLines.some(
        (line) => Number(line.qtyReserved || 0) > 0,
      );
      so.status = allReserved
        ? 'RESERVED'
        : anyReserved
          ? 'PARTIAL_RESERVED'
          : so.status;
      await soRepo.save(so);

      return this.findOne(id);
    });
  }

  async unreserve(id: string, dto: UnreserveSalesOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const soRepo = manager.getRepository(ErpSalesOrder);
      const soLineRepo = manager.getRepository(ErpSalesOrderLine);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);

      const so = await this.getSalesOrderOrThrow(soRepo, id);
      const lines = await soLineRepo.find({
        where: { salesOrderId: id },
        order: { lineNo: 'ASC' },
      });
      if (lines.length === 0) {
        throw new BadRequestException('Sales order chưa có dòng hàng');
      }

      for (const line of lines) {
        const qtyReserved = Number(line.qtyReserved || 0);
        if (qtyReserved <= 0) {
          continue;
        }

        const balance = await balanceRepo.findOne({
          where: {
            itemId: line.itemId ?? undefined,
            warehouseCode: dto.warehouseCode ?? undefined,
          } as any,
        });
        if (!balance) {
          continue;
        }

        const balanceReserved = Number(balance.qtyReserved || 0);
        const qtyToRelease = Math.min(balanceReserved, qtyReserved);
        balance.qtyReserved = Math.max(
          0,
          balanceReserved - qtyToRelease,
        ).toFixed(3);
        await balanceRepo.save(balance);

        line.qtyReserved = Math.max(0, qtyReserved - qtyToRelease).toFixed(3);
        await soLineRepo.save(line);
      }

      const refreshedLines = await soLineRepo.find({
        where: { salesOrderId: id },
      });
      const anyReserved = refreshedLines.some(
        (line) => Number(line.qtyReserved || 0) > 0,
      );
      const allDelivered =
        refreshedLines.length > 0 &&
        refreshedLines.every(
          (line) =>
            Number(line.qtyDelivered || 0) >= Number(line.qtyOrdered || 0),
        );
      const anyDelivered = refreshedLines.some(
        (line) => Number(line.qtyDelivered || 0) > 0,
      );

      if (allDelivered) {
        so.status = 'DELIVERED';
      } else if (anyReserved) {
        so.status = 'PARTIAL_RESERVED';
      } else if (anyDelivered) {
        so.status = 'PARTIAL_DELIVERED';
      } else {
        so.status = 'DRAFT';
      }
      await soRepo.save(so);

      return this.findOne(id);
    });
  }

  async remove(id: string) {
    const existing = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!existing)
      throw new NotFoundException(`Đơn bán hàng ${id} không tìm thấy`);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể xóa đơn bán hàng nháp');
    }

    await this.repository.update(id, { isDeleted: true } as any);
    return { message: 'Xóa thành công' };
  }

  async cancel(id: string) {
    const existing = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!existing)
      throw new NotFoundException(`Đơn bán hàng ${id} không tìm thấy`);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Đơn bán hàng đã bị hủy');
    }
    if (existing.status === 'DRAFT') {
      throw new BadRequestException('Không thể hủy đơn nháp, vui lòng xóa');
    }

    // Call dependencies check just in case
    await this.dependencyService.checkDependencies('sales_service_orders', id);

    existing.status = 'CANCELLED';
    await this.repository.save(existing);

    return {
      message: 'Hủy thành công',
      data: { id },
    };
  }
}
