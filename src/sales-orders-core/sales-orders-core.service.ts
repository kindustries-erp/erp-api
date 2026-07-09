import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, In, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpSalesOrder } from './entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from './entities/erp_sales_order_line.entity';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { ReserveSalesOrderDto } from './dto/reserve-sales-order.dto';
import { UnreserveSalesOrderDto } from './dto/unreserve-sales-order.dto';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpInventoryTrackingSerial } from '../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpGoodsIssue } from '../goods-issues-core/entities/erp_goods_issue.entity';
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

  private async generateMonthlySoNo(manager: any, orderDate?: string) {
    const baseDate = orderDate ? new Date(orderDate) : new Date();
    const year = baseDate.getUTCFullYear();
    const month = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    const prefix = `SO-${year}${month}-`;
    const latest = await manager
      .getRepository(ErpSalesOrder)
      .createQueryBuilder('so')
      .where('so.soNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('so.soNo', 'DESC')
      .getOne();
    const latestSeq = latest?.soNo?.slice(prefix.length) ?? '000';
    const nextSeq = String(Number(latestSeq || '0') + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }

  private async reserveSerialsForLine(
    manager: any,
    line: any,
    savedLineId: string,
    itemId: string | null,
  ) {
    let reservedQtyForLine = 0;
    if (line.serialIds && line.serialIds.length > 0) {
      const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);
      const serials = await serialRepo.find({
        where: { id: In(line.serialIds), status: 'IN_STOCK' },
      });
      if (serials.length > 0) {
        reservedQtyForLine = serials.length;
        await serialRepo.update(
          { id: In(serials.map((s: any) => s.id)) },
          { status: 'RESERVED', salesOrderLineId: savedLineId },
        );

        const balances = await balanceRepo.find({
          where: { itemId: itemId ?? undefined } as any,
        });
        let remainingToReserve = reservedQtyForLine;
        for (const b of balances) {
          const available =
            Number(b.qtyOnHand || 0) - Number(b.qtyReserved || 0);
          if (available > 0 && remainingToReserve > 0) {
            const toReserve = Math.min(available, remainingToReserve);
            b.qtyReserved = (Number(b.qtyReserved || 0) + toReserve).toFixed(3);
            await balanceRepo.save(b);
            remainingToReserve -= toReserve;
          }
        }
      }
    }
    return reservedQtyForLine;
  }

  async getNextSoNo(date?: string): Promise<{ nextNo: string }> {
    const nextNo = await this.dataSource.transaction((manager) =>
      this.generateMonthlySoNo(manager, date),
    );
    return { nextNo };
  }

  async create(dto: CreateSalesOrderDto) {
    const { lines = [], ...header } = dto;
    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(ErpSalesOrder);
      const lineRepo = manager.getRepository(ErpSalesOrderLine);
      const soNo =
        header.soNo?.trim() ||
        (await this.generateMonthlySoNo(manager, header.orderDate));
      const headerPayload: DeepPartial<ErpSalesOrder> = {
        status: header.status ?? 'DRAFT',
        ...header,
        soNo,
      };
      const data = await headerRepo.save(headerPayload);
      const savedLines: ErpSalesOrderLine[] = [];
      let lineNo = 1;
      for (const line of lines) {
        const linePayload: DeepPartial<ErpSalesOrderLine> = {
          salesOrderId: data.id,
          lineNo: lineNo++,
          itemId: line.itemId ?? null,
          itemName: line.itemName ?? null,
          qtyOrdered: line.qtyOrdered,
          qtyReserved: '0',
          qtyDelivered: '0',
          unitPrice: line.unitPrice ?? null,
          amount: line.amount ?? null,
          selectedSerialIds: line.serialIds ?? null,
        };
        const saved = await lineRepo.save(linePayload);

        const reservedQtyForLine = await this.reserveSerialsForLine(
          manager,
          line as any,
          saved.id,
          saved.itemId,
        );
        if (reservedQtyForLine > 0) {
          saved.qtyReserved = String(reservedQtyForLine);
          await lineRepo.save(saved);
        }

        savedLines.push(saved);
      }

      const anyReserved = savedLines.some(
        (l) => Number(l.qtyReserved || 0) > 0,
      );
      const allReserved =
        savedLines.length > 0 &&
        savedLines.every(
          (l) => Number(l.qtyReserved || 0) >= Number(l.qtyOrdered || 0),
        );
      if (allReserved && data.status !== 'RESERVED') {
        data.status = 'RESERVED';
        await headerRepo.save(data);
      } else if (
        anyReserved &&
        data.status !== 'PARTIAL_RESERVED' &&
        data.status !== 'RESERVED'
      ) {
        data.status = 'PARTIAL_RESERVED';
        await headerRepo.save(data);
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

    const notFullyIssued = (query as any).notFullyIssued === 'true';
    const statusFilter = (query as any).status;

    const baseWhere: any = {
      ...(query.search ? { soNo: ILike(`%${query.search}%`) } : {}),
      isDeleted: false,
    };

    if (notFullyIssued) {
      baseWhere.status = In(['RESERVED', 'PARTIAL_DELIVERED']);
    } else if (statusFilter) {
      baseWhere.status = statusFilter;
    }

    const tagId = (query as any).tag_id as string | undefined;

    if (tagId) {
      const taggedRows = await this.dataSource.query(
        `SELECT entity_id FROM sys_entity_tags WHERE entity_type = 'erp_sales_order' AND tag_id = $1`,
        [tagId],
      );
      const taggedIds = taggedRows.map((r: any) => r.entity_id) as string[];
      if (taggedIds.length === 0) {
        return { items: [], total: 0, page, pageSize, totalPages: 0 };
      }
      const [items, total] = await this.repository.findAndCount({
        where: [{ ...baseWhere, id: In(taggedIds) }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        order,
      });
      return this.enrichCustomerNames({
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    }

    const [items, total] = await this.repository.findAndCount({
      where: [baseWhere],
      skip: (page - 1) * pageSize,
      take: pageSize,
      order,
    });
    return this.enrichCustomerNames({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  }

  private async enrichCustomerNames(result: any) {
    if (result.items.length > 0) {
      const customerIds = [
        ...new Set(result.items.map((i: any) => i.customerId).filter(Boolean)),
      ];
      if (customerIds.length > 0) {
        const partners = await this.dataSource.query(
          `SELECT id, name FROM erp_business_partners WHERE id = ANY($1)`,
          [customerIds],
        );
        const partnerMap = new Map(partners.map((p: any) => [p.id, p.name]));
        for (const item of result.items) {
          if (item.customerId) {
            item.customerName = partnerMap.get(item.customerId);
          }
        }
      }
    }
    return result;
  }

  async findOne(id: string) {
    const data = await this.getSalesOrderOrThrow(this.repository, id);
    const lines = await this.lineRepository.find({
      where: { salesOrderId: id },
      order: { lineNo: 'ASC' },
    });

    // Inject serialIds
    const serialRepo = this.dataSource.getRepository(
      ErpInventoryTrackingSerial,
    );
    const serials = await serialRepo.find({
      where: { salesOrderLineId: In(lines.map((l) => l.id)) },
    });
    const serialsByLine = serials.reduce(
      (acc, s) => {
        if (!acc[s.salesOrderLineId!]) acc[s.salesOrderLineId!] = [];
        acc[s.salesOrderLineId!].push(s.id);
        return acc;
      },
      {} as Record<string, string[]>,
    );

    const itemIds = [
      ...new Set(lines.map((l) => l.itemId).filter(Boolean)),
    ] as string[];
    const itemsMap: Record<string, string> = {};
    if (itemIds.length > 0) {
      const itemRepo = this.dataSource.getRepository(ErpInventoryItem);
      const items = await itemRepo.find({ where: { id: In(itemIds) } });
      for (const it of items) {
        itemsMap[it.id] = it.itemName;
      }
    }

    const linesWithSerials = lines.map((l) => ({
      ...l,
      serialIds: serialsByLine[l.id] || [],
      itemName: l.itemName || (l.itemId ? itemsMap[l.itemId] : null),
    }));

    const goodsIssueRepo = this.dataSource.getRepository(ErpGoodsIssue);
    const goodsIssues = await goodsIssueRepo.find({
      where: { salesOrderId: id } as any,
      order: { createdAt: 'DESC' },
    });

    return {
      message: 'Lấy thông tin thành công',
      data: { ...data, lines: linesWithSerials, goodsIssues },
    };
  }

  private async releaseSerialsAndBalances(manager: any, salesOrderId: string) {
    const lineRepo = manager.getRepository(ErpSalesOrderLine);
    const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
    const balanceRepo = manager.getRepository(ErpInventoryBalance);

    const lines = await lineRepo.find({ where: { salesOrderId } });
    if (lines.length === 0) return;

    for (const line of lines) {
      const qtyReserved = Number(line.qtyReserved || 0);
      if (qtyReserved > 0) {
        const balances = await balanceRepo.find({
          where: { itemId: line.itemId ?? undefined } as any,
        });
        let remainingToUnreserve = qtyReserved;
        for (const balance of balances) {
          if (remainingToUnreserve <= 0) break;
          const balanceReserved = Number(balance.qtyReserved || 0);
          if (balanceReserved > 0) {
            const qtyToRelease = Math.min(
              balanceReserved,
              remainingToUnreserve,
            );
            balance.qtyReserved = Math.max(
              0,
              balanceReserved - qtyToRelease,
            ).toFixed(3);
            await balanceRepo.save(balance);
            remainingToUnreserve -= qtyToRelease;
          }
        }
      }
    }

    await serialRepo.update(
      { salesOrderLineId: In(lines.map((l) => l.id)), status: 'RESERVED' },
      { status: 'IN_STOCK', salesOrderLineId: null },
    );
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
        await this.releaseSerialsAndBalances(manager, id);
        const lineRepo = manager.getRepository(ErpSalesOrderLine);
        await lineRepo.delete({ salesOrderId: id });
        let lineNo = 1;
        const savedLines: ErpSalesOrderLine[] = [];
        for (const line of lines) {
          const linePayload: DeepPartial<ErpSalesOrderLine> = {
            salesOrderId: id,
            lineNo: lineNo++,
            itemId: line.itemId ?? null,
            itemName: line.itemName ?? null,
            qtyOrdered: line.qtyOrdered,
            qtyReserved: line.qtyReserved ?? '0',
            qtyDelivered: line.qtyDelivered ?? '0',
            unitPrice: line.unitPrice ?? null,
            amount: line.amount ?? null,
            selectedSerialIds: line.serialIds ?? null,
          };
          const saved = await lineRepo.save(linePayload);

          const reservedQtyForLine = await this.reserveSerialsForLine(
            manager,
            line as any,
            saved.id,
            saved.itemId,
          );
          if (reservedQtyForLine > 0) {
            saved.qtyReserved = String(reservedQtyForLine);
            await lineRepo.save(saved);
          }
          savedLines.push(saved);
        }

        const so = await manager.getRepository(ErpSalesOrder).findOneBy({ id });
        if (so && so.status !== 'CANCELLED') {
          const anyReserved = savedLines.some(
            (l) => Number(l.qtyReserved || 0) > 0,
          );
          const allReserved =
            savedLines.length > 0 &&
            savedLines.every(
              (l) => Number(l.qtyReserved || 0) >= Number(l.qtyOrdered || 0),
            );
          if (allReserved && so.status !== 'RESERVED') {
            so.status = 'RESERVED';
            await manager.getRepository(ErpSalesOrder).save(so);
          } else if (
            anyReserved &&
            so.status !== 'PARTIAL_RESERVED' &&
            so.status !== 'RESERVED'
          ) {
            so.status = 'PARTIAL_RESERVED';
            await manager.getRepository(ErpSalesOrder).save(so);
          }
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
        let qtyToReserve = Math.min(available, qtyNeedReserve);
        if (qtyToReserve <= 0) {
          continue;
        }

        const item = line.itemId
          ? await manager
              .getRepository(ErpInventoryItem)
              .findOne({ where: { id: line.itemId } as any })
          : null;
        if (
          item?.trackingPolicyId &&
          item.trackingPolicyId !== 'NONE' &&
          line.itemId
        ) {
          if (!line.selectedSerialIds || line.selectedSerialIds.length === 0) {
            continue;
          }
          const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
          const availableSerials = await serialRepo.find({
            where: { id: In(line.selectedSerialIds), status: 'IN_STOCK' },
          });

          if (availableSerials.length === 0) {
            continue;
          }

          qtyToReserve = Math.min(qtyToReserve, availableSerials.length);
          const serialsToReserve = availableSerials.slice(0, qtyToReserve);

          await serialRepo.update(
            { id: In(serialsToReserve.map((s) => s.id)) },
            { status: 'RESERVED', salesOrderLineId: line.id },
          );
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

      // Release serials
      if (lines.length > 0) {
        const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
        await serialRepo.update(
          { salesOrderLineId: In(lines.map((l) => l.id)), status: 'RESERVED' },
          { status: 'IN_STOCK', salesOrderLineId: null },
        );
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
        so.status = 'DELIVERING';
      } else if (anyReserved) {
        so.status = 'PARTIAL_RESERVED';
      } else if (anyDelivered) {
        so.status = 'PARTIAL_DELIVERING';
      } else {
        so.status = 'CONFIRMED';
      }
      await soRepo.save(so);

      return this.findOne(id);
    });
  }

  async confirmAllDelivery(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const soRepo = manager.getRepository(ErpSalesOrder);
      const so = await this.getSalesOrderOrThrow(soRepo, id);

      if (so.status !== 'DELIVERING' && so.status !== 'PARTIAL_DELIVERING') {
        throw new BadRequestException(
          'Chỉ có thể xác nhận giao hàng khi đơn hàng đang ở trạng thái đang giao',
        );
      }

      // Check if there are any DELIVERING serials to prevent bypassing tracking
      const soLineRepo = manager.getRepository(ErpSalesOrderLine);
      const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
      const lines = await soLineRepo.find({ where: { salesOrderId: so.id } });
      if (lines.length > 0) {
        const anyDeliveringSerial = await serialRepo.findOne({
          where: {
            salesOrderLineId: In(lines.map((l) => l.id)),
            status: 'DELIVERING',
          },
        });
        if (anyDeliveringSerial) {
          throw new BadRequestException(
            'Đơn hàng có thiết bị tracking đang giao, vui lòng xác nhận giao từng serial/xe cụ thể',
          );
        }
      }

      so.status = 'DELIVERED';
      await soRepo.save(so);

      return this.findOne(id);
    });
  }

  async remove(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const soRepo = manager.getRepository(ErpSalesOrder);
      const existing = await soRepo.findOne({
        where: { id, isDeleted: false },
      });
      if (!existing)
        throw new NotFoundException(`Đơn bán hàng ${id} không tìm thấy`);
      if (existing.status !== 'DRAFT') {
        throw new BadRequestException('Chỉ có thể xóa đơn bán hàng nháp');
      }

      const soLineRepo = manager.getRepository(ErpSalesOrderLine);
      const lines = await soLineRepo.find({ where: { salesOrderId: id } });
      if (lines.length > 0) {
        const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
        await serialRepo.update(
          { salesOrderLineId: In(lines.map((l) => l.id)), status: 'RESERVED' },
          { status: 'IN_STOCK', salesOrderLineId: null },
        );
      }

      await soRepo.update(id, { isDeleted: true } as any);
      return { message: 'Xóa thành công' };
    });
  }

  async cancel(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const soRepo = manager.getRepository(ErpSalesOrder);
      const soLineRepo = manager.getRepository(ErpSalesOrderLine);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);

      const existing = await soRepo.findOne({
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
      await this.dependencyService.checkDependencies(
        'sales_service_orders',
        id,
      );

      // Unreserve logic
      const lines = await soLineRepo.find({ where: { salesOrderId: id } });
      for (const line of lines) {
        const qtyReserved = Number(line.qtyReserved || 0);
        if (qtyReserved > 0) {
          const balances = await balanceRepo.find({
            where: { itemId: line.itemId ?? undefined } as any,
          });
          let remainingToUnreserve = qtyReserved;
          for (const balance of balances) {
            if (remainingToUnreserve <= 0) break;
            const balanceReserved = Number(balance.qtyReserved || 0);
            if (balanceReserved > 0) {
              const qtyToRelease = Math.min(
                balanceReserved,
                remainingToUnreserve,
              );
              balance.qtyReserved = Math.max(
                0,
                balanceReserved - qtyToRelease,
              ).toFixed(3);
              await balanceRepo.save(balance);
              remainingToUnreserve -= qtyToRelease;
            }
          }
          line.qtyReserved = '0';
          await soLineRepo.save(line);
        }
      }

      // Release serials
      if (lines.length > 0) {
        const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
        await serialRepo.update(
          { salesOrderLineId: In(lines.map((l) => l.id)), status: 'RESERVED' },
          { status: 'IN_STOCK', salesOrderLineId: null },
        );
      }

      existing.status = 'CANCELLED';
      await soRepo.save(existing);

      return {
        message: 'Hủy thành công',
        data: { id },
      };
    });
  }
}
